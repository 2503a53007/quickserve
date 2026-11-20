import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import type { AdminClient } from '@/lib/supabase/server';

/**
 * API conventions (all /api routes):
 *   success -> 200/201 { data: T }
 *   failure -> 4xx/5xx  { error: { message, code?, fieldErrors? } }
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}
export const badRequest = (m: string, code = 'BAD_REQUEST') => new ApiError(400, m, code);
export const unauthorized = (m = 'Please sign in to continue') => new ApiError(401, m, 'UNAUTHORIZED');
export const forbidden = (m = 'You do not have access to this resource') => new ApiError(403, m, 'FORBIDDEN');
export const notFound = (m = 'Not found') => new ApiError(404, m, 'NOT_FOUND');
export const conflict = (m: string, code = 'CONFLICT') => new ApiError(409, m, code);

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });
export const created = <T>(data: T) => ok(data, 201);

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: consistent errors, no stack/secret leakage. */
export function route<P = Record<string, string>>(handler: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { message: e.message, code: e.code, fieldErrors: e.fieldErrors } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.entries(fieldErrors)[0];
    return NextResponse.json(
      { error: { message: first ? `${first[0]}: ${first[1]?.[0]}` : 'Invalid input', code: 'VALIDATION', fieldErrors } },
      { status: 400 },
    );
  }
  const pg = e as { code?: string; message?: string; details?: string };
  // Postgres constraint / trigger errors surfaced by PostgREST
  if (pg?.code === '23P01' || pg?.message?.includes('no_provider_double_booking')) {
    return NextResponse.json({ error: { message: 'That time slot was just taken. Please choose another time.', code: 'SLOT_TAKEN' } }, { status: 409 });
  }
  if (pg?.message?.includes('COMPANY_CAPACITY')) {
    return NextResponse.json({ error: { message: 'No worker is free for that slot. Please choose another time.', code: 'SLOT_TAKEN' } }, { status: 409 });
  }
  if (pg?.message?.includes('INVALID_TRANSITION')) {
    return NextResponse.json({ error: { message: 'This booking can no longer be changed that way.', code: 'INVALID_STATE' } }, { status: 409 });
  }
  if (pg?.code === '23505') return NextResponse.json({ error: { message: 'This already exists.', code: 'DUPLICATE' } }, { status: 409 });
  if (pg?.code === '23503') return NextResponse.json({ error: { message: 'Referenced record does not exist.', code: 'BAD_REFERENCE' } }, { status: 400 });
  if (pg?.code === '23514' || pg?.code === '22P02') return NextResponse.json({ error: { message: 'Some of the values are invalid.', code: 'VALIDATION' } }, { status: 400 });
  console.error('[api] unhandled error', e);
  const msg = e instanceof Error && e.message.startsWith('Missing required server environment variable') ? e.message : 'Something went wrong. Please try again.';
  return NextResponse.json({ error: { message: msg, code: 'INTERNAL' } }, { status: 500 });
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
  return schema.parse(json);
}
export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** DB-backed fixed-window limiter. Throws 429 when exceeded. */
export async function rateLimit(admin: AdminClient, key: string, max: number, windowSeconds: number, message = 'Too many attempts. Please wait a bit and try again.') {
  const { data, error } = await admin.rpc('check_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) throw error;
  if (data === false) throw new ApiError(429, message, 'RATE_LIMITED');
}

export async function audit(admin: AdminClient, entry: {
  actorId?: string | null; action: string; entity: string; entityId?: string | null; metadata?: Record<string, unknown>; ip?: string;
}) {
  const { error } = await admin.from('audit_logs').insert({
    actor_id: entry.actorId ?? null, action: entry.action, entity: entry.entity, entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {}, ip: entry.ip ?? null,
  });
  if (error) console.error('[audit] failed to write', error.message);
}

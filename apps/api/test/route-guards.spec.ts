/// <reference types="jest" />
import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { OptionalAuthGuard } from '../src/common/guards/optional-auth.guard';

type Controller = { name: string; prototype: Record<string, unknown> };

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return controllerFiles(path);
    return /\.controller\.ts$/.test(entry) ? [path] : [];
  });
}

const controllers: Controller[] = controllerFiles(
  join(__dirname, '../src'),
).flatMap((file) =>
  // Controllers are discovered from the file system, so the module path is only known at run time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Object.values(require(file) as Record<string, unknown>).filter(
    (value): value is Controller =>
      typeof value === 'function' && /Controller$/.test(value.name),
  ),
);

const guardsOf = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

describe('route guards', () => {
  it('finds the API controllers', () => {
    expect(controllers.length).toBeGreaterThanOrEqual(8);
  });

  // Handlers that read @CurrentUser() receive `undefined` unless a guard sets request.user,
  // which shows up as a 500 for signed-in users and anonymous callers alike.
  it('every handler that reads the current user sits behind a sign-in guard', () => {
    const unprotected: string[] = [];
    for (const controller of controllers) {
      const classGuards = guardsOf(controller);
      for (const method of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[method];
        if (method === 'constructor' || typeof handler !== 'function') continue;
        const args = (Reflect.getMetadata(
          ROUTE_ARGS_METADATA,
          controller,
          method,
        ) ?? {}) as Record<string, unknown>;
        const readsUser = Object.keys(args).some((key) =>
          key.includes('__customRouteArgs__'),
        );
        if (!readsUser) continue;
        const guards = [...classGuards, ...guardsOf(handler)];
        if (
          !guards.some(
            (guard) => guard === AuthGuard || guard === OptionalAuthGuard,
          )
        )
          unprotected.push(`${controller.name}.${method}`);
      }
    }
    expect(unprotected).toEqual([]);
  });
});

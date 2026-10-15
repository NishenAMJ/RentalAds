import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';

export interface AuthenticatedUser {
  authUserId: string;
  email: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly supabase: ReturnType<typeof createClient>;

  constructor(config: ConfigService) {
    const url =
      config.get<string>('SUPABASE_URL') ??
      config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const key =
      config.get<string>('SUPABASE_PUBLISHABLE_KEY') ??
      config.get<string>('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
      config.get<string>('SUPABASE_ANON_KEY') ??
      config.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY') ??
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      throw new Error(
        'Supabase configuration requires a URL and API key in apps/api/.env.',
      );
    }

    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      authUserId: data.user.id,
      email: data.user.email ?? '',
    };

    return true;
  }
}

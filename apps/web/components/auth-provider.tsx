"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { AccountRole } from "@/lib/login-destination";
type State = {
  session: Session | null;
  loading: boolean;
  error: string | null;
};
export type AdminPermissions = {
  canApproveListings: boolean;
  canManageAdmins: boolean;
  canManageComplaints: boolean;
};
const noPermissions: AdminPermissions = {
  canApproveListings: false,
  canManageAdmins: false,
  canManageComplaints: false,
};
type Auth = State & {
  role: AccountRole | null;
  permissions: AdminPermissions;
  isAdmin: boolean;
  permissionsLoading: boolean;
  profileError: string | null;
  user: Session["user"] | null;
  signOut: () => Promise<void>;
};
import { apiRequest } from "@/lib/api-client";
const Context = createContext<Auth | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    session: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let active = true;
    let revision = 0;
    let unsubscribe = () => {};
    void Promise.resolve()
      .then(async () => {
        if (!active) return;
        const client = getSupabase();
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          revision += 1;
          if (active) setState({ session, loading: false, error: null });
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const initialRevision = revision;
        const { data: initial, error } = await client.auth.getSession();
        // Never overwrite a newer auth event with an older session read.
        if (active && revision === initialRevision)
          setState({
            session: error ? null : initial.session,
            loading: false,
            error: error?.message ?? null,
          });
      })
      .catch((cause: unknown) => {
        if (active)
          setState({
            session: null,
            loading: false,
            error:
              cause instanceof Error
                ? cause.message
                : "Unable to check sign-in.",
          });
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const userId = state.session?.user.id;
  const accessToken = state.session?.access_token;
  const [profile, setProfile] = useState<{
    userId: string;
    accessToken: string;
    error: string | null;
    permissions: AdminPermissions;
    role: AccountRole | null;
  } | null>(null);
  useEffect(() => {
    if (!userId || !accessToken) return;
    let active = true;
    let revision = 0;
    async function load() {
      const current = ++revision;
      try {
        const data = await apiRequest<{
          authUserId: string;
          role: AccountRole;
          adminPermission: AdminPermissions | null;
        }>("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
        if (data.authUserId !== userId) throw new Error("Account verification mismatch");
        if (active && current === revision)
          setProfile({
            userId: userId!,
            accessToken: accessToken!,
            error: null,
            role: data.role,
            permissions: {
              canApproveListings: data.adminPermission?.canApproveListings === true,
              canManageAdmins: data.adminPermission?.canManageAdmins === true,
              canManageComplaints: data.adminPermission?.canManageComplaints === true,
            },
          });
      } catch {
        if (active && current === revision)
          setProfile({ userId: userId!, accessToken: accessToken!, permissions: noPermissions, role: null,
            error: "We couldn't verify your account access. Please sign in again or retry." });
      }
    }
    void load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [userId, accessToken]);
  const currentProfile = profile?.userId === userId && profile?.accessToken === accessToken ? profile : null;
  const permissions =
    userId && currentProfile ? currentProfile.permissions : noPermissions;
  const isAdmin = Object.values(permissions).some(Boolean);
  const permissionsLoading = !!userId && !currentProfile;
  async function signOut() {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error) throw error;
    setState({ session: null, loading: false, error: null });
    setProfile(null);
  }
  return (
    <Context.Provider
      value={{
        ...state,
        role: currentProfile?.role ?? null,
        permissions,
        isAdmin,
        permissionsLoading,
        profileError: currentProfile?.error ?? null,
        user: state.session?.user ?? null,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Same origin as the panel, so no baseURL is needed: the client resolves
 * `/api/auth/*` relative to wherever it is served from, which keeps preview
 * deployments working without configuration.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;

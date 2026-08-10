import { cookies } from "next/headers";
import { authMode, createOAuthState, oauthStateCookieName, oauthStateTtlSeconds } from "../../../../auth";
import { entraClient, entraScopes } from "../_lib";

export const runtime = "nodejs";

export async function GET() {
  if (authMode() !== "entra") return Response.redirect(new URL("/login", process.env.ENTRA_REDIRECT_URI || "http://localhost:3000"));

  try {
    const { client, config } = entraClient();
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const url = await client.getAuthCodeUrl({
      scopes: entraScopes(),
      redirectUri: config.redirectUri,
      state,
      nonce,
      responseMode: "query",
    });
    (await cookies()).set(oauthStateCookieName(), createOAuthState(state, nonce), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: oauthStateTtlSeconds(),
    });
    return Response.redirect(url);
  } catch (error) {
    return Response.redirect(new URL(`/login?error=${encodeURIComponent(error instanceof Error ? error.message : "Entra sign-in is not configured")}`, process.env.ENTRA_REDIRECT_URI || "http://localhost:3000"));
  }
}

import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

export async function middleware(request) {
    const labToken = request.cookies.get("token")?.value;
    const adminToken = request.cookies.get("super_admin_token")?.value;
    const pathname = request.nextUrl.pathname;
    console.log("Middleware check: labToken =", labToken, "adminToken =", adminToken, "for path:", pathname);

    const isDashboard = pathname.startsWith("/dashboard");
    const isStaffDashboard = pathname.startsWith("/staff-dashboard");
    const isLoginPage = pathname === "/" || pathname === "/login";
    const isAdminLogin = pathname === "/admin-login";
    const isAdminDashboard = pathname.startsWith("/admin-dashboard");

    const validAdminToken = adminToken && adminToken === (process.env.SUPER_ADMIN_TOKEN || "super_admin_demo_token");

    if (isAdminDashboard && !validAdminToken) {
        return NextResponse.redirect(new URL("/admin-login", request.url));
    }

    if (isAdminLogin && validAdminToken) {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
    }

    if ((isDashboard || isStaffDashboard) && !labToken) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    if (labToken) {
        try {
            await ensureDatabaseIndexes();
            const collections = await getCollections();
            const labs = collections?.labs;
            if (!labs) {
                console.warn("Middleware: labs collection missing");
                return NextResponse.redirect(new URL("/", request.url));
            }

            const lab = await labs.findOne({ token: labToken });
            if (!lab) {
                return NextResponse.redirect(new URL("/", request.url));
            }
        } catch (err) {
            console.error("Middleware DB check failed:", err);
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    if (isLoginPage && labToken) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}


export const config = {
    matcher: [
        "/",
        "/login",
        "/dashboard/:path*",
        "/staff-dashboard/:path*",
        "/admin-login",
        "/admin-dashboard/:path*"
    ]
};
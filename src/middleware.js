import { NextResponse } from "next/server";

function decodeJwtPayload(token) {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length < 2) return null;

    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(padded);
        const utf8 = decodeURIComponent(
            Array.from(decoded).map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")
        );
        return JSON.parse(utf8);
    } catch {
        return null;
    }
}

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
        const decoded = decodeJwtPayload(labToken);
        const role = decoded?.role;

        if (!decoded) {
            console.warn("Middleware: invalid lab token");
            return NextResponse.redirect(new URL("/", request.url));
        }

        if (isDashboard && role !== "lab_admin") {
            return NextResponse.redirect(new URL("/", request.url));
        }

        if (isStaffDashboard && role !== "staff") {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    if (isLoginPage && labToken) {
        const decoded = decodeJwtPayload(labToken);
        const redirectPath = decoded?.role === "staff" ? "/staff-dashboard" : "/dashboard";
        if (decoded) {
            return NextResponse.redirect(new URL(redirectPath, request.url));
        }
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
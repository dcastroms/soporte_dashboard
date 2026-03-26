import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findAllUsers, updateUser } from "@/lib/models/UserModel";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const users = await findAllUsers({ orderBy: { createdAt: -1 } });

        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { userId, role, permissions } = body;

        if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

        const data: Record<string, unknown> = {};
        if (role && ['ADMIN', 'USER'].includes(role)) data.role = role;
        if (Array.isArray(permissions)) data.permissions = permissions;

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
        }

        const updatedUser = await updateUser(userId, data);

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

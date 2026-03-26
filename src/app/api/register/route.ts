export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email.endsWith("@mediastre.am")) {
      return Response.json({ error: "Solo se permiten correos de @mediastre.am" }, { status: 400 });
    }

    const { findUserByEmail, createUser } = await import("@/lib/models/UserModel");
    const bcrypt = await import("bcryptjs");

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return Response.json({ error: "El usuario ya existe" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser({ name, email, password: hashedPassword, role: "USER", permissions: [] });

    return Response.json({ message: "Usuario creado con éxito", user: { email: user.email, name: user.name } });
  } catch (error) {
    console.error("Registration Error:", error);
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

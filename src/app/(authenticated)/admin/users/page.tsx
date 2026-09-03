import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-utils";
import { desc } from "drizzle-orm";
import { UserList } from "@/components/admin/user-list";
import { CreateUserForm } from "@/components/admin/create-user-form";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt));

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} users · Manage team members
          </p>
        </div>
        <CreateUserForm />
      </div>

      <UserList users={serialized} />
    </div>
  );
}

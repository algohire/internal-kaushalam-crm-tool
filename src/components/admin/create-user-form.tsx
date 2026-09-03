"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUser } from "@/lib/actions/user-management";
import { createUserSchema } from "@/lib/validations";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "caller",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const parsed = createUserSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const result = await createUser(form);
    setLoading(false);

    if ("error" in result) {
      toast.error(String(result.error));
      return;
    }

    toast.success(`User ${form.name} created`);
    setOpen(false);
    setForm({ name: "", email: "", password: "", role: "caller" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button className="bg-[#620124] hover:bg-[#7B1A36]">
          <Plus className="w-4 h-4 mr-1.5" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Display Name</Label>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="caller">Caller</option>
              <option value="admin">Admin</option>
            </select>
            {fieldErrors.role && (
              <p className="text-sm text-destructive mt-1">{fieldErrors.role}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#620124] hover:bg-[#7B1A36]"
            >
              {loading ? "Creating…" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toggleUserActive, resetPassword, changeRole } from "@/lib/actions/user-management";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

export function UserList({ users }: { users: UserRow[] }) {
  const [resetDialogUser, setResetDialogUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleToggleActive(userId: string) {
    const result = await toggleUserActive(userId);
    if ("error" in result) {
      toast.error(String(result.error));
    } else {
      toast.success("User status updated");
    }
  }

  async function handleChangeRole(userId: string, role: string) {
    const result = await changeRole(userId, role);
    if ("error" in result) {
      toast.error(String(result.error));
    } else {
      toast.success("Role updated");
    }
  }

  async function handleResetPassword() {
    if (!resetDialogUser || !newPassword) return;
    setLoading(true);
    const result = await resetPassword(resetDialogUser.id, newPassword);
    setLoading(false);
    if ("error" in result) {
      toast.error(String(result.error));
    } else {
      toast.success("Password reset");
      setResetDialogUser(null);
      setNewPassword("");
    }
  }

  return (
    <>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-sm">{u.name}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      u.role === "admin"
                        ? "bg-[#620124]/10 text-[#620124] border-[#620124]/20"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }
                  >
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        u.active ? "bg-green-500" : "bg-red-400"
                      }`}
                    />
                    <span className="text-sm">{u.active ? "Active" : "Inactive"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("en-IN")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleToggleActive(u.id)}>
                        {u.active ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetDialogUser(u)}>
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleChangeRole(u.id, u.role === "admin" ? "caller" : "admin")
                        }
                      >
                        Change to {u.role === "admin" ? "Caller" : "Admin"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!resetDialogUser} onOpenChange={() => setResetDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password — {resetDialogUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetDialogUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={loading || !newPassword}
                className="bg-[#620124] hover:bg-[#7B1A36]"
              >
                {loading ? "Resetting…" : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

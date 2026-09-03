"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, XCircle } from "lucide-react";
import { addContact, markContactInvalid } from "@/lib/actions/contact";

type Contact = {
  id: string;
  name: string | null;
  designation: string | null;
  mobile: string | null;
  mobileRaw: string | null;
  email: string | null;
  pocFor: string | null;
  source: string;
  isPrimary: boolean;
  valid: boolean;
};

type Props = {
  contacts: Contact[];
  companyCode: string;
  dialogOpen: boolean;
  onDialogChange: (open: boolean) => void;
};

export function ContactsTable({ contacts, companyCode, dialogOpen, onDialogChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    designation: "",
    mobile: "",
    email: "",
    pocFor: "requirement",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function handleAdd() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.mobile && !/^\d{7,15}$/.test(form.mobile.replace(/\D/g, "")))
      errs.mobile = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Invalid email format";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    startTransition(async () => {
      await addContact({ companyCode, ...form });
      setForm({ name: "", designation: "", mobile: "", email: "", pocFor: "requirement" });
      setFieldErrors({});
      onDialogChange(false);
    });
  }

  function handleInvalidate(contactId: string) {
    startTransition(() => {
      markContactInvalid(contactId, companyCode);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Contacts</CardTitle>
            <span className="text-xs text-muted-foreground">{contacts.length}</span>
          </div>
          <Dialog open={dialogOpen} onOpenChange={onDialogChange}>
            <DialogTrigger>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                  {fieldErrors.name && <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>}
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input
                    value={form.designation}
                    onChange={(e) => updateField("designation", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input
                    value={form.mobile}
                    onChange={(e) => updateField("mobile", e.target.value)}
                    placeholder="10-digit mobile"
                  />
                  {fieldErrors.mobile && <p className="text-sm text-destructive mt-1">{fieldErrors.mobile}</p>}
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                  {fieldErrors.email && <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>}
                </div>
                <div>
                  <Label>POC for</Label>
                  <Select value={form.pocFor as string} onValueChange={(v) => setForm({ ...form, pocFor: v ?? "requirement" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="requirement">Requirement</SelectItem>
                      <SelectItem value="drive">Drive</SelectItem>
                      <SelectItem value="portal">Portal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={isPending || !form.name} className="w-full">
                  {isPending ? "Adding…" : "Add Contact"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>POC for</TableHead>
              <TableHead>Source</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id} className={!c.valid ? "opacity-50" : ""}>
                <TableCell className={!c.valid ? "line-through" : ""}>
                  {c.name ?? "—"}
                  {c.isPrimary && (
                    <Badge variant="outline" className="ml-1 text-xs bg-green-50 text-green-700 border-green-200">
                      Primary
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{c.designation ?? "—"}</TableCell>
                <TableCell>
                  {c.mobile ? (
                    <a href={`tel:${c.mobile}`} className="text-[#620124] font-medium tabular-nums">
                      {c.mobileRaw || c.mobile}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                <TableCell className="text-sm capitalize">{c.pocFor ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      c.source === "edb"
                        ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                        : "text-xs"
                    }
                  >
                    {c.source === "edb" ? "EDB" : c.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  {c.valid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-7 px-2 text-xs"
                      onClick={() => handleInvalidate(c.id)}
                      disabled={isPending}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Invalid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {contacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No contacts yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

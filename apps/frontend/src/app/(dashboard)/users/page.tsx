"use client";

import { useEffect, useMemo, useState } from "react";
import { usersApi, type UserPayload, type UserRole } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { PageHeader } from "@/components/layout/page-header";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Edit3,
  Loader2,
  Mail,
  Phone,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";

type ManagedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  branchId?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type UserFormState = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  pin: string;
  role: UserRole;
  avatarUrl: string;
  isActive: boolean;
};

const emptyForm: UserFormState = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  password: "",
  pin: "",
  role: "CASHIER",
  avatarUrl: "",
  isActive: true,
};

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  CASHIER: "Cajero",
  WAITER: "Mesero",
};

const roleClassNames: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-violet-50 text-violet-700 border-violet-200",
  ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
  CASHIER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WAITER: "bg-amber-50 text-amber-700 border-amber-200",
};

function toForm(user: ManagedUser): UserFormState {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? "",
    password: "",
    pin: "",
    role: user.role,
    avatarUrl: user.avatarUrl ?? "",
    isActive: user.isActive,
  };
}

function toCreatePayload(form: UserFormState): UserPayload {
  return {
    email: form.email.trim().toLowerCase(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim() || undefined,
    password: form.password,
    pin: form.pin.trim() || undefined,
    role: form.role,
    avatarUrl: form.avatarUrl.trim() || undefined,
  };
}

function toUpdatePayload(form: UserFormState): Omit<Partial<UserPayload>, "password"> {
  return {
    email: form.email.trim().toLowerCase(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim() || undefined,
    pin: form.pin.trim() || undefined,
    role: form.role,
    avatarUrl: form.avatarUrl.trim() || undefined,
    isActive: form.isActive,
  };
}

export default function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canManage = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [pendingAction, setPendingAction] = useState<{
    user: ManagedUser;
    type: "toggle" | "delete";
  } | null>(null);

  const loadUsers = () => {
    setIsLoading(true);
    setError(null);
    usersApi
      .getAll()
      .then((nextUsers) => setUsers(nextUsers))
      .catch(() => setError("No se pudieron cargar los usuarios. Verifica permisos y conexion."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (canManage) {
      loadUsers();
    } else {
      setIsLoading(false);
    }
  }, [canManage]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [user.firstName, user.lastName, user.email, user.phone ?? "", roleLabels[user.role]]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm(toForm(user));
    setDialogOpen(true);
  };

  const validateForm = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return "Nombre y apellido son obligatorios.";
    }
    if (!form.email.trim()) {
      return "El correo es obligatorio.";
    }
    if (!editingUser && form.password.length < 6) {
      return "La contrasena debe tener al menos 6 caracteres.";
    }
    if (form.pin && !/^\d{4}$/.test(form.pin)) {
      return "El PIN debe tener exactamente 4 digitos.";
    }
    return null;
  };

  const saveUser = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, toUpdatePayload(form));
      } else {
        await usersApi.create(toCreatePayload(form));
      }
      setDialogOpen(false);
      loadUsers();
    } catch {
      setError("No se pudo guardar el usuario. Revisa correo, rol y permisos.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setIsSaving(true);
    setError(null);
    try {
      if (pendingAction.type === "delete") {
        await usersApi.delete(pendingAction.user.id);
      } else {
        await usersApi.update(pendingAction.user.id, {
          isActive: !pendingAction.user.isActive,
        });
      }
      setPendingAction(null);
      loadUsers();
    } catch {
      setError("No se pudo completar la accion solicitada.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Usuarios"
          description="Administracion de usuarios y roles"
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No tienes permisos para administrar usuarios.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Crea, edita y controla el acceso del equipo por rol"
        actions={
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_190px_170px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo, telefono o rol"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="CASHIER">Cajero</SelectItem>
            <SelectItem value="WAITER">Mesero</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadUsers}>
          Actualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Usuarios</p>
          <p className="mt-1 text-2xl font-bold">{users.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Activos</p>
          <p className="mt-1 text-2xl font-bold">
            {users.filter((user) => user.isActive).length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Administradores</p>
          <p className="mt-1 text-2xl font-bold">
            {users.filter((user) => user.role === "SUPER_ADMIN" || user.role === "ADMIN").length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Operativos</p>
          <p className="mt-1 text-2xl font-bold">
            {users.filter((user) => user.role === "CASHIER" || user.role === "WAITER").length}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-32 text-center text-muted-foreground">
                    No hay usuarios para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-sm font-semibold text-white">
                          {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-muted-foreground">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="text-sm text-foreground">{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("gap-1", roleClassNames[user.role])}>
                        <ShieldCheck className="h-3 w-3" />
                        {roleLabels[user.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive ? "success" : "secondary"}>
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.createdAt ? formatDate(user.createdAt) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingAction({ user, type: "toggle" })}
                          disabled={user.id === currentUser?.id}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setPendingAction({ user, type: "delete" })}
                          disabled={user.id === currentUser?.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Apellido</Label>
                <Input
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Correo electronico</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            {!editingUser && (
              <div className="grid gap-2">
                <Label>Contrasena temporal</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Telefono</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>PIN rapido</Label>
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, "") })}
                  placeholder={editingUser ? "Dejar vacio para conservar" : "Opcional"}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(value: UserRole) => setForm({ ...form, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="CASHIER">Cajero</SelectItem>
                    <SelectItem value="WAITER">Mesero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Avatar URL</Label>
                <Input
                  value={form.avatarUrl}
                  onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
                />
              </div>
            </div>
            {editingUser && (
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  disabled={editingUser.id === currentUser?.id}
                />
                Usuario activo
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveUser} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete"
                ? "Eliminar usuario"
                : pendingAction?.user.isActive
                  ? "Desactivar usuario"
                  : "Activar usuario"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete"
                ? "El usuario se eliminara con soft delete y dejara de poder iniciar sesion."
                : "El acceso del usuario cambiara inmediatamente para futuros inicios de sesion."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={isSaving}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

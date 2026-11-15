"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { id, must, run, UserError } from "./admin-shared";

/** Promote a user to admin or demote an admin to student. An admin cannot demote themself. */
export async function setUserRole(userId: string, role: "student" | "admin") {
  const me = await requireAdmin();
  return run(async (db) => {
    const v = z.object({ userId: id, role: z.enum(["student", "admin"]) }).parse({ userId, role });
    if (v.userId === me.id && v.role !== "admin") throw new UserError("Tu ne peux pas retirer ton propre rôle d'administrateur.");
    if (v.role === "student") {
      const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) throw new UserError("Il doit rester au moins un administrateur.");
    }
    must(await db.from("profiles").update({ role: v.role }).eq("id", v.userId).select("id").single(), "profil");
    revalidatePath("/admin/etudiants", "layout");
    return { role: v.role };
  });
}

"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/trustry/button";
import { StatusBadge } from "@/components/trustry/badge";
import { ROLE_LABEL, type Role } from "@/domain/access";
import { inviteMember, updateMember, type MemberActionState } from "@/app/(app)/[espace]/parametres/[onglet]/actions";

const control = "h-[34px] rounded-full border border-line bg-blanc px-3 text-meta text-ink outline-0 focus:border-carbone";
const ROLES: Role[] = ["admin", "manager", "viewer"];

export type MemberRowData = {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  omsAccess: boolean;
  isSelf: boolean;
};

function Feedback({ state }: { state: MemberActionState }) {
  if (state.error) return <p className="text-caption text-critique">{state.error}</p>;
  if (state.ok) return <p className="text-caption text-bon">{state.ok}</p>;
  return null;
}

export function MemberRow({ espace, member, canManage, showOms }: { espace: string; member: MemberRowData; canManage: boolean; showOms: boolean }) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(updateMember, {});
  const locked = !canManage || member.role === "owner" || member.isSelf;
  const ownerOrAdmin = member.role === "owner" || member.role === "admin";
  return (
    <tr className="border-b border-line last:border-0 align-middle">
      <td className="py-3 pr-2">
        <span className="block font-semibold">
          {member.fullName}
          {member.isSelf ? <span className="ml-1.5 text-caption font-normal text-muted">(vous)</span> : null}
        </span>
        {member.email ? <span className="text-caption text-muted">{member.email}</span> : null}
        <Feedback state={state} />
      </td>
      <td className="px-2 py-3">
        {locked ? (
          ROLE_LABEL[member.role]
        ) : (
          <form action={action}>
            <input type="hidden" name="espace" value={espace} />
            <input type="hidden" name="membre" value={member.userId} />
            <input type="hidden" name="intent" value="role" />
            <select
              name="role"
              defaultValue={member.role}
              aria-label={`Rôle de ${member.fullName}`}
              disabled={pending}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={control}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </form>
        )}
      </td>
      {showOms ? (
        <td className="px-2 py-3">
          {locked || ownerOrAdmin ? (
            <StatusBadge tone={member.omsAccess ? "bon" : "neutre"}>
              {member.omsAccess ? (ownerOrAdmin ? "Accès (d'office)" : "Accès") : "Pas d'accès"}
            </StatusBadge>
          ) : (
            <form action={action}>
              <input type="hidden" name="espace" value={espace} />
              <input type="hidden" name="membre" value={member.userId} />
              <input type="hidden" name="intent" value="module" />
              <input type="hidden" name="acces" value={member.omsAccess ? "non" : "oui"} />
              <button
                type="submit"
                role="switch"
                aria-checked={member.omsAccess}
                aria-label={`Accès Import OMS pour ${member.fullName}`}
                disabled={pending}
                className="flex cursor-pointer items-center gap-2 text-meta"
              >
                <span className={`relative inline-block h-[22px] w-[38px] flex-none rounded-full transition-colors ${member.omsAccess ? "bg-carbone" : "bg-line-strong"}`}>
                  <span
                    className={`absolute top-[3px] left-0 size-4 rounded-full shadow-toggle transition-transform ${member.omsAccess ? "translate-x-[19px] bg-fluo" : "translate-x-[3px] bg-blanc"}`}
                  />
                </span>
                {member.omsAccess ? "Accès" : "Pas d'accès"}
              </button>
            </form>
          )}
        </td>
      ) : null}
      <td className="py-3 pl-2 text-right">
        {!locked ? (
          <form
            action={action}
            onSubmit={(e) => {
              if (!window.confirm(`Retirer ${member.fullName} de cet espace ?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="espace" value={espace} />
            <input type="hidden" name="membre" value={member.userId} />
            <input type="hidden" name="intent" value="retirer" />
            <Button type="submit" size="sm" variant="ghost" disabled={pending} className="text-critique">
              Retirer
            </Button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}

export function InviteForm({ espace, showOms }: { espace: string; showOms: boolean }) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(inviteMember, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="espace" value={espace} />
        <label className="flex flex-col gap-1.5 text-meta font-semibold">
          Email
          <input name="email" type="email" required placeholder="prenom@entreprise.fr" className="h-10 w-64 rounded-full border border-line bg-blanc px-3.5 text-nav font-normal outline-0 focus:border-carbone" />
        </label>
        <label className="flex flex-col gap-1.5 text-meta font-semibold">
          Rôle
          <select name="role" defaultValue="viewer" className="h-10 rounded-full border border-line bg-blanc px-3.5 text-nav font-normal outline-0">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        {showOms ? (
          <label className="flex h-10 items-center gap-2 text-meta">
            <input type="checkbox" name="oms" value="oui" className="size-4 accent-carbone" />
            Accès Import OMS
          </label>
        ) : null}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Création..." : "Inviter"}
        </Button>
      </form>
      {state.error ? <p className="text-meta text-critique">{state.error}</p> : null}
      {state.link ? (
        <div className="flex flex-wrap items-center gap-2 rounded-item bg-blanc p-3">
          <p className="min-w-0 flex-1 text-meta">
            {state.ok} Transmettez ce lien (valable 7 jours, usage unique) :
            <code className="mt-1 block truncate font-mono text-2xs text-ink-2">{state.link}</code>
          </p>
          <Button
            size="sm"
            variant="accent"
            onClick={async () => {
              await navigator.clipboard.writeText(state.link ?? "");
              setCopied(true);
            }}
          >
            {copied ? "Copié" : "Copier le lien"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EditIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { meQueryOptions } from "@/server/fns/auth";

interface EditModeValue {
  /** Effective edit mode — only ever true for an admin who has toggled it on. */
  editMode: boolean;
  /** Whether the current user is allowed to toggle edit mode (admins only). */
  canEdit: boolean;
  setEditMode: (value: boolean) => void;
}

const EditModeContext = createContext<EditModeValue | null>(null);

/**
 * Provides page edit-mode state. Edit mode is an admin-only authoring toggle:
 * non-admins always see the rendered (view) page. State is in-memory and
 * defaults off, so a reload returns to view mode.
 */
export function EditModeProvider({ children }: { children: ReactNode }) {
  const me = useQuery(meQueryOptions());
  const canEdit = Boolean(me.data?.roles.includes("admin"));
  const [editMode, setEditMode] = useState(false);

  const value = useMemo<EditModeValue>(
    () => ({ editMode: canEdit && editMode, canEdit, setEditMode }),
    [canEdit, editMode],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode(): EditModeValue {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within an EditModeProvider");
  return ctx;
}

/** Header control that toggles edit mode. Renders nothing for non-admins. */
export function EditModeToggle() {
  const { editMode, canEdit, setEditMode } = useEditMode();
  if (!canEdit) return null;

  const label = editMode ? "Editing on — click to view" : "Editing off — click to edit";
  return (
    <Button
      type="button"
      size="xs"
      variant={editMode ? "default" : "outline"}
      aria-pressed={editMode}
      aria-label={label}
      title={label}
      onClick={() => setEditMode(!editMode)}
    >
      {/* fill follows the button's text color so the icon stays visible in the
          outline variant / dark mode (Button doesn't set svg fill itself). */}
      <EditIcon fill="currentColor" />
    </Button>
  );
}

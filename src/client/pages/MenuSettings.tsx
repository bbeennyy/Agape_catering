import { useEffect, useId, useRef, useState } from "react";
import { api, uploadFile, type Catalog, type MenuItem } from "../api";
import { Photo } from "../components/ui";
import { formatMoneyShort } from "../../shared/pricing";

export function MenuSettings() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catId, setCatId] = useState<string>("");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");

  async function reload() {
    const data = await api<Catalog>("/catalog");
    setCatalog(data);
    setCatId((id) => id || data.categories[0]?.id || "");
  }

  useEffect(() => {
    reload();
  }, []);

  if (!catalog) return <p>Loading…</p>;
  const category = catalog.categories.find((c) => c.id === catId);

  async function saveItem(item: Partial<MenuItem> & { id?: string; categoryId: string; name: string }) {
    if (item.id) {
      await api(`/items/${item.id}`, { method: "PATCH", body: JSON.stringify(item) });
    } else {
      await api("/items", { method: "POST", body: JSON.stringify(item) });
    }
    setEditing(null);
    setNewName("");
    await reload();
    setMsg("Saved");
  }

  return (
    <div>
      <h1 className="font-serif text-3xl">Menu</h1>
      <p className="mt-1 text-sm text-ink/60">
        Add, hide, reprice, or move items between categories. Photos are optional.
      </p>
      {msg ? <p className="mt-2 text-sm text-sage">{msg}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {catalog.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatId(c.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              c.id === catId ? "bg-sage text-white" : "bg-paper"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-4">
        <h2 className="font-serif text-xl">Packages</h2>
        <div className="mt-3 grid gap-3">
          {catalog.packages.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0">
              <div className="min-w-48 flex-1 font-medium">{p.name}</div>
              <label className="text-sm">
                Price $
                <input
                  type="number"
                  step="0.01"
                  className="ml-2 w-28 rounded border border-line px-2 py-1"
                  defaultValue={p.priceCents == null ? "" : p.priceCents / 100}
                  onBlur={async (e) => {
                    const v = e.target.value;
                    await api(`/packages/${p.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ priceCents: v === "" ? null : Math.round(Number(v) * 100) }),
                    });
                    setMsg("Package price saved");
                  }}
                />
              </label>
              <span className="text-xs text-ink/50">{p.priceUnit}</span>
            </div>
          ))}
        </div>
      <p className="mt-2 text-xs text-ink/50">Dinner should stay 18. Empty dessert price means TBD.</p>
      </div>

      {category ? (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">{category.name}</h2>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                await saveItem({
                  name: newName.trim(),
                  categoryId: category.id,
                  priceCents: category.slug === "salads" ? 300 : category.slug === "addons" ? 300 : null,
                  isAddOn: category.slug === "salads" || category.slug === "addons",
                });
              }}
            >
              <input
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
                placeholder={`Add ${category.name.toLowerCase()} item`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button className="rounded-full bg-sage px-3 py-1.5 text-sm text-white" type="submit">
                Add
              </button>
            </form>
          </div>
          <div className="mt-4 grid gap-3">
            {category.items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl border border-line bg-paper p-3">
                {editing?.id === item.id ? null : (
                  <Photo url={item.photoUrl} name={item.name} className="h-16 w-16 shrink-0 rounded-lg text-sm" />
                )}
                {editing?.id === item.id ? (
                  <ItemForm
                    item={editing}
                    categories={catalog.categories}
                    onCancel={() => setEditing(null)}
                    onSave={saveItem}
                  />
                ) : (
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-ink/55">{item.description || "No description"}</div>
                      <div className="mt-1 text-sm text-terra">
                        {item.priceCents == null ? "Included / no extra price" : `${formatMoneyShort(item.priceCents)} ${item.priceUnit === "FLAT" ? "" : "pp"}`}
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button type="button" className="text-sage" onClick={() => setEditing(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-terra"
                        onClick={async () => {
                          if (!confirm(`Delete ${item.name}?`)) return;
                          await api(`/items/${item.id}`, { method: "DELETE" });
                          await reload();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ItemForm({
  item,
  categories,
  onCancel,
  onSave,
}: {
  item: MenuItem;
  categories: Catalog["categories"];
  onCancel: () => void;
  onSave: (item: MenuItem) => Promise<void>;
}) {
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      setDraft((d) => ({ ...d, photoUrl: url }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form
      className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(draft);
        setBusy(false);
      }}
    >
      <input
        className="rounded border border-line px-2 py-1"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <select
        className="rounded border border-line px-2 py-1"
        value={draft.categoryId}
        onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        className="sm:col-span-2 rounded border border-line px-2 py-1"
        placeholder="Description"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <label className="text-sm sm:col-span-2">
        Price $ (empty = none)
        <input
          className="ml-2 w-28 rounded border border-line px-2 py-1"
          type="number"
          step="0.01"
          value={draft.priceCents == null ? "" : draft.priceCents / 100}
          onChange={(e) =>
            setDraft({
              ...draft,
              priceCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
            })
          }
        />
      </label>

      <div className="sm:col-span-2">
        <input
          ref={fileRef}
          id={fileInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
        <label
          htmlFor={fileInputId}
          className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-4 py-3 transition ${
            draft.photoUrl
              ? "border-sage/40 bg-mist/40 hover:border-sage"
              : "border-sage/50 bg-sage/5 hover:border-sage hover:bg-sage/10"
          }`}
        >
          <Photo
            url={draft.photoUrl}
            name={draft.name}
            className="h-20 w-20 shrink-0 rounded-lg text-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sage-dark">
              {uploading ? "Uploading…" : draft.photoUrl ? "Change photo" : "Add a photo"}
            </div>
            <p className="mt-0.5 text-xs text-ink/55">
              {draft.photoUrl
                ? "Click to replace this image. JPG or PNG."
                : "Optional — click to upload a photo clients will see in the menu."}
            </p>
            {draft.photoUrl ? (
              <button
                type="button"
                className="mt-2 text-xs text-terra hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraft((d) => ({ ...d, photoUrl: null }));
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </label>
      </div>

      <div className="sm:col-span-2 flex gap-2">
        <button className="rounded-full bg-sage px-3 py-1 text-sm text-white" disabled={busy || uploading}>
          Save
        </button>
        <button type="button" className="text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

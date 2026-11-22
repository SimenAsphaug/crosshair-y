import { CSSProperties, useEffect, useMemo, useState } from "react";
import {
  Search,
  Star,
  MoreHorizontal,
  Plus,
  Upload,
  Pencil,
  Copy,
  Trash2,
  Share2,
  FolderInput,
  FolderPlus,
  Crosshair,
  Check,
  Download,
  RefreshCw,
  Globe,
  Library as LibraryIcon,
  Sparkles,
  Bookmark,
  Github,
  Shuffle,
} from "lucide-react";
import type { Design, SavedDesign } from "../../../shared/types";
import { BUILTIN_DESIGNS } from "../../../shared/builtins";
import { defaultDesign, toSaved, uid } from "../../../shared/design";
import { useApp } from "../state";
import { Thumb } from "../components/Thumb";
import { Empty, PromptModal, ConfirmModal, Segmented, useMenu, MenuEntry, Notice } from "../components/ui";
import { ImportModal, ShareModal, useAdopt } from "../components/ShareImport";
import { fetchCommunity, CommunityEntry } from "../../lib/community";
import { randomDesign } from "../../lib/random";

type Tab = "saved" | "builtin" | "community";
type Sort = "manual" | "name" | "recent";
type Size = "s" | "m" | "l";
const CARD_W: Record<Size, string> = { s: "118px", m: "150px", l: "200px" };
const THUMB: Record<Size, number> = { s: 70, m: 96, l: 140 };

export function LibraryPage() {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>("saved");
  const [importing, setImporting] = useState(false);
  const [size, setSize] = useState<Size>(() => (localStorage.getItem("lib-size") as Size) || "m");
  useEffect(() => {
    try {
      localStorage.setItem("lib-size", size);
    } catch {}
  }, [size]);
  const { openDesigner } = useApp();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Crosshairs</h1>
          <p>Click a crosshair to use it. Double-click to edit it.</p>
        </div>
        <div className="actions">
          <Segmented
            value={size}
            onChange={setSize}
            options={[
              { value: "s", label: "S", title: "Small tiles" },
              { value: "m", label: "M", title: "Medium tiles" },
              { value: "l", label: "L", title: "Large tiles" },
            ]}
          />
          <button className="btn" onClick={() => setImporting(true)}>
            <Upload size={15} /> Import
          </button>
          <button className="btn primary" onClick={() => openDesigner(defaultDesign("New crosshair"))}>
            <Plus size={15} /> New
          </button>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === "saved" ? "active" : ""}`} onClick={() => setTab("saved")}>
          <Bookmark size={15} /> Saved <span className="count">{state.designs.length}</span>
        </button>
        <button className={`tab ${tab === "builtin" ? "active" : ""}`} onClick={() => setTab("builtin")}>
          <LibraryIcon size={15} /> Built-in <span className="count">{BUILTIN_DESIGNS.length}</span>
        </button>
        <button className={`tab ${tab === "community" ? "active" : ""}`} onClick={() => setTab("community")}>
          <Globe size={15} /> Community
        </button>
      </div>
      <div style={{ "--card-w": CARD_W[size] } as CSSProperties}>
        {tab === "saved" && <SavedTab thumb={THUMB[size]} />}
        {tab === "builtin" && <CatalogTab thumb={THUMB[size]} entries={BUILTIN_DESIGNS.map((b) => ({ design: b.design, tags: b.tags, sub: b.tags[0] }))} origin="builtin" />}
        {tab === "community" && <CommunityTab thumb={THUMB[size]} />}
      </div>
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}

// ── Saved ──

function SavedTab({ thumb }: { thumb: number }) {
  const { state, dispatch, openDesigner, toast, activeDesign, effectiveProfile } = useApp();
  const [filter, setFilter] = useState<string>("all"); // all | favorites | category id
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("manual");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<null | { title: string; label: string; initial?: string; confirm?: string; submit: (v: string) => void }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; text: string; run: () => void }>(null);
  const [sharing, setSharing] = useState<Design | null>(null);
  const menu = useMenu();

  const cats = state.categories;
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: state.designs.length, favorites: state.designs.filter((d) => d.favorite).length };
    for (const c of cats) m[c.id] = state.designs.filter((d) => d.categoryId === c.id).length;
    return m;
  }, [state.designs, cats]);

  const list = useMemo(() => {
    let l = state.designs;
    if (filter === "favorites") l = l.filter((d) => d.favorite);
    else if (filter !== "all") l = l.filter((d) => d.categoryId === filter);
    const q = query.trim().toLowerCase();
    if (q) l = l.filter((d) => d.name.toLowerCase().includes(q));
    if (sort === "name") l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "recent") l = [...l].sort((a, b) => b.updatedAt - a.updatedAt);
    return l;
  }, [state.designs, filter, query, sort]);

  const canReorder = sort === "manual" && !query;

  const addCategory = (then?: (id: string) => void) =>
    setPrompt({
      title: "New category",
      label: "Name",
      confirm: "Create",
      submit: (name) => {
        const id = uid("c_");
        dispatch({ type: "category/add", category: { id, name } });
        then?.(id);
      },
    });

  const use = (d: SavedDesign) => {
    dispatch({ type: "design/activate", id: d.id });
    if (!state.overlayEnabled) toast(`Equipped “${d.name}”. The crosshair is currently turned off.`, "info");
  };

  const duplicate = (d: SavedDesign) => {
    const copy = toSaved({ ...d, id: uid("d_"), name: `${d.name} copy` }, "user");
    copy.categoryId = d.categoryId;
    dispatch({ type: "design/save", design: copy });
    toast("Duplicated");
  };

  const tileMenu = (d: SavedDesign): MenuEntry[] => [
    { label: "Use", icon: <Crosshair size={15} />, onClick: () => use(d) },
    { label: "Edit in designer", icon: <Pencil size={15} />, onClick: () => openDesigner(d, d.id) },
    { label: "Duplicate", icon: <Copy size={15} />, onClick: () => duplicate(d) },
    {
      label: "Rename",
      icon: <Pencil size={15} />,
      onClick: () => setPrompt({ title: "Rename crosshair", label: "Name", initial: d.name, submit: (name) => dispatch({ type: "design/save", design: { ...d, name } }) }),
    },
    { label: "Share / export", icon: <Share2 size={15} />, onClick: () => setSharing(d) },
    { separator: true },
    { heading: "Move to category" },
    {
      label: "None",
      icon: d.categoryId === null ? <Check size={15} /> : <span style={{ width: 15 }} />,
      onClick: () => dispatch({ type: "design/category", id: d.id, categoryId: null }),
    },
    ...cats.map((c) => ({
      label: c.name,
      icon: d.categoryId === c.id ? <Check size={15} /> : <FolderInput size={15} />,
      onClick: () => dispatch({ type: "design/category", id: d.id, categoryId: c.id }),
    })),
    { label: "New category…", icon: <FolderPlus size={15} />, onClick: () => addCategory((id) => dispatch({ type: "design/category", id: d.id, categoryId: id })) },
    { separator: true },
    {
      label: "Delete",
      icon: <Trash2 size={15} />,
      danger: true,
      onClick: () => setConfirm({ title: "Delete crosshair?", text: `“${d.name}” will be removed from your library.`, run: () => dispatch({ type: "design/delete", id: d.id }) }),
    },
  ];

  const catMenu = (id: string, name: string): MenuEntry[] => [
    { label: "Rename", icon: <Pencil size={15} />, onClick: () => setPrompt({ title: "Rename category", label: "Name", initial: name, submit: (n) => dispatch({ type: "category/rename", id, name: n }) }) },
    {
      label: "Delete category",
      icon: <Trash2 size={15} />,
      danger: true,
      onClick: () =>
        setConfirm({
          title: "Delete category?",
          text: `Crosshairs in “${name}” stay in your library and are moved out of the category.`,
          run: () => {
            dispatch({ type: "category/delete", id });
            if (filter === id) setFilter("all");
          },
        }),
    },
  ];

  const onDropOnTile = (targetId: string) => {
    if (!dragId || dragId === targetId || !canReorder) return;
    const ids = state.designs.map((d) => d.id).filter((id) => id !== dragId);
    const idx = ids.indexOf(targetId);
    ids.splice(idx, 0, dragId);
    dispatch({ type: "design/reorder", ids });
  };

  const SideItem = ({ id, label, icon }: { id: string; label: string; icon: JSX.Element }) => (
    <button
      className={`cat ${filter === id ? "active" : ""} ${dropTarget === `cat:${id}` ? "drop" : ""}`}
      onClick={() => setFilter(id)}
      onContextMenu={(e) => {
        const c = cats.find((x) => x.id === id);
        if (c) menu.open(e, catMenu(c.id, c.name));
      }}
      onDragOver={(e) => {
        if (!dragId || id === "all") return;
        e.preventDefault();
        setDropTarget(`cat:${id}`);
      }}
      onDragLeave={() => setDropTarget(null)}
      onDrop={(e) => {
        e.preventDefault();
        setDropTarget(null);
        if (!dragId) return;
        if (id === "favorites") dispatch({ type: "design/favorite", id: dragId, favorite: true });
        else if (id !== "all") dispatch({ type: "design/category", id: dragId, categoryId: id });
      }}
    >
      {icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span className="n">{counts[id] ?? 0}</span>
    </button>
  );

  return (
    <div className="library">
      <aside className="lib-side">
        <SideItem id="all" label="All" icon={<Crosshair size={15} />} />
        <SideItem id="favorites" label="Favorites" icon={<Star size={15} />} />
        <div className="menu-label">Categories</div>
        {cats.map((c) => (
          <SideItem key={c.id} id={c.id} label={c.name} icon={<FolderInput size={15} />} />
        ))}
        <button className="cat" onClick={() => addCategory()}>
          <Plus size={15} /> New category
        </button>
        {cats.length > 0 && <div className="faint" style={{ fontSize: 11.5, padding: "6px 10px" }}>Drag crosshairs onto a category. Right-click to rename.</div>}
      </aside>

      <section>
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Search saved crosshairs" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} title="Sort">
            <option value="manual">Manual order</option>
            <option value="name">Name</option>
            <option value="recent">Recently edited</option>
          </select>
        </div>

        {list.length === 0 ? (
          <Empty icon={<Crosshair size={34} />} title={query ? "No matches" : filter === "favorites" ? "No favorites yet" : "Nothing here yet"}>
            {filter === "favorites" ? "Star a crosshair to pin it here." : "Create one in the Designer, or grab one from Built-in or Community."}
          </Empty>
        ) : (
          <div className="grid">
            {list.map((d) => {
              const active = activeDesign?.id === d.id;
              return (
                <div
                  key={d.id}
                  className={`tile ${active ? "active" : ""} ${dragId === d.id ? "dragging" : ""} ${dropTarget === d.id ? "drop-before" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(d.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragId || !canReorder || dragId === d.id) return;
                    e.preventDefault();
                    setDropTarget(d.id);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === d.id ? null : t))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    onDropOnTile(d.id);
                  }}
                  onClick={() => use(d)}
                  onDoubleClick={() => openDesigner(d, d.id)}
                  onContextMenu={(e) => menu.open(e, tileMenu(d))}
                  title={d.name}
                >
                  <div className="thumb">
                    <Thumb design={d} size={thumb} />
                    <div className={`corner left ${d.favorite ? "keep" : ""}`}>
                      <button
                        className={`btn ghost icon sm fav ${d.favorite ? "on" : ""}`}
                        title={d.favorite ? "Unfavorite" : "Favorite"}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: "design/favorite", id: d.id, favorite: !d.favorite });
                        }}
                      >
                        <Star size={15} fill={d.favorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                    {active && (
                      <span className="badge accent active-badge">
                        <Check size={11} /> {effectiveProfile?.name ?? "In use"}
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    <div className="name">{d.name}</div>
                    <button className="btn ghost icon sm" title="More" onClick={(e) => menu.open(e, tileMenu(d))}>
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {menu.node}
      {prompt && <PromptModal title={prompt.title} label={prompt.label} initial={prompt.initial} confirm={prompt.confirm} onSubmit={prompt.submit} onClose={() => setPrompt(null)} />}
      {confirm && (
        <ConfirmModal title={confirm.title} onConfirm={confirm.run} onClose={() => setConfirm(null)}>
          {confirm.text}
        </ConfirmModal>
      )}
      {sharing && <ShareModal design={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}

// ── Built-in & community catalogs ──

interface CatalogEntry {
  design: Design;
  tags: string[];
  sub?: string;
}

function CatalogTab({ entries, origin, thumb, toolbarExtra }: { entries: CatalogEntry[]; origin: "builtin" | "community"; thumb: number; toolbarExtra?: JSX.Element }) {
  const { dispatch, openDesigner, toast, state } = useApp();
  const adopt = useAdopt();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const menu = useMenu();

  const tags = useMemo(() => {
    const count = new Map<string, number>();
    entries.forEach((e) => e.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  }, [entries]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) => (!tag || e.tags.includes(tag)) && (!q || e.design.name.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)) || e.sub?.toLowerCase().includes(q)),
    );
  }, [entries, query, tag]);

  const saved = (d: Design) => state.designs.some((x) => x.id === (origin === "builtin" ? "bi_" : "cm_") + d.id.replace(/^(builtin|community):/, ""));

  const use = (d: Design) => {
    const id = adopt(d, origin);
    dispatch({ type: "design/activate", id });
    toast(`Equipped “${d.name}”`);
  };
  const save = (d: Design) => {
    adopt(d, origin);
    toast(`Saved “${d.name}” to your library`);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <Search size={15} />
          <input className="input" placeholder="Search by name or tag" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {toolbarExtra}
      </div>
      {tags.length > 1 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className={`btn sm ${tag === null ? "primary" : ""}`} onClick={() => setTag(null)}>
            All
          </button>
          {tags.map((t) => (
            <button key={t} className={`btn sm ${tag === t ? "primary" : ""}`} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <Empty icon={<Search size={30} />} title="No matches" />
      ) : (
        <div className="grid">
          {list.map((e) => {
            const isSaved = saved(e.design);
            const items: MenuEntry[] = [
              { label: "Use", icon: <Crosshair size={15} />, onClick: () => use(e.design) },
              { label: isSaved ? "Saved" : "Save to library", icon: <Download size={15} />, onClick: () => save(e.design) },
              { label: "Customize in designer", icon: <Pencil size={15} />, onClick: () => openDesigner({ ...e.design, id: uid("d_") }) },
            ];
            return (
              <div key={e.design.id} className="tile" onClick={() => use(e.design)} onContextMenu={(ev) => menu.open(ev, items)} title={e.design.name}>
                <div className="thumb">
                  <Thumb design={e.design} size={thumb} />
                  <div className="corner right">
                    <button
                      className="btn ghost icon sm"
                      title={isSaved ? "In your library" : "Save to library"}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        save(e.design);
                      }}
                    >
                      {isSaved ? <Check size={15} /> : <Bookmark size={15} />}
                    </button>
                  </div>
                </div>
                <div className="meta">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="name">{e.design.name}</div>
                    {e.sub && <div className="sub">{e.sub}</div>}
                  </div>
                  <button className="btn ghost icon sm" title="More" onClick={(ev) => menu.open(ev, items)}>
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {menu.node}
    </div>
  );
}

let communityCache: { url: string; entries: CommunityEntry[] } | null = null;

function CommunityTab({ thumb }: { thumb: number }) {
  const { state, openDesigner, activeDesign } = useApp();
  const url = state.settings.communityIndexUrl;
  const [entries, setEntries] = useState<CommunityEntry[] | null>(communityCache?.url === url ? communityCache.entries : null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const e = await fetchCommunity(url);
      communityCache = { url, entries: e };
      setEntries(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!entries) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const catalog = useMemo<CatalogEntry[]>(
    () =>
      (entries ?? []).map((e) => ({
        design: e.design,
        tags: [...e.tags, ...(e.game ? [e.game.toLowerCase()] : [])],
        sub: `by ${e.author}${e.game ? ` · ${e.game}` : ""}`,
      })),
    [entries],
  );

  const extra = (
    <>
      <button className="btn" onClick={load} disabled={loading} title="Reload">
        <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
      </button>
      <button className="btn" onClick={() => setSharing(true)} disabled={!activeDesign}>
        <Github size={15} /> Submit yours
      </button>
    </>
  );

  return (
    <div>
      {error ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="toolbar">{extra}</div>
          <Notice kind="warn">
            {error}
            <div className="faint" style={{ marginTop: 4 }}>
              Source: <span className="mono">{url}</span>. You can change it in Settings → Community.
            </div>
          </Notice>
          <Empty icon={<Sparkles size={32} />} title="Make your own instead">
            <button className="btn primary" style={{ marginTop: 6 }} onClick={() => openDesigner(randomDesign())}>
              <Shuffle size={15} /> Surprise me
            </button>
          </Empty>
        </div>
      ) : !entries ? (
        <Empty icon={<RefreshCw size={28} />} title="Loading community crosshairs…" />
      ) : (
        <CatalogTab entries={catalog} origin="community" thumb={thumb} toolbarExtra={extra} />
      )}
      {sharing && activeDesign && <ShareModal design={activeDesign} initialTab="submit" onClose={() => setSharing(false)} />}
    </div>
  );
}

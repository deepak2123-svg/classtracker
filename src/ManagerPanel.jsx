import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconArrowLeft,
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
  IconLink,
  IconLogout,
  IconPlus,
  IconRefresh,
  IconSchool,
  IconSearch,
  IconShieldCheck,
  IconUserShield,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import {
  createGroupStructure,
  createScopedInvite,
  createTenantInstitute,
  getManagerDashboard,
  logout,
} from "./firebase";
import { getAdminAppUrl, getTeacherAppUrl } from "./platform";

const PAGE_SIZE = 25;

const C = {
  page: "#F4F6F8",
  surface: "#FFFFFF",
  ink: "#17212B",
  muted: "#66717D",
  border: "#DDE2E7",
  dark: "#182B26",
  green: "#1F7A56",
  greenSoft: "#E8F4EE",
  blue: "#285A9F",
  blueSoft: "#EAF1FA",
  amber: "#9A6400",
  amberSoft: "#FFF5D9",
  red: "#B33A3A",
};

function Icon({ component: Component, size = 18 }) {
  return <Component size={size} stroke={1.9} aria-hidden="true" />;
}

function DetailStat({ label, value, icon, tone = "green" }) {
  const palette = tone === "blue"
    ? { background: C.blueSoft, color: C.blue }
    : tone === "amber"
      ? { background: C.amberSoft, color: C.amber }
      : { background: C.greenSoft, color: C.green };
  return (
    <div className="manager-detail-stat">
      <span className="manager-detail-stat-icon" style={palette}>
        <Icon component={icon} size={19} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function EmptyDirectory({ filtered = false }) {
  return (
    <div className="manager-empty">
      <Icon component={filtered ? IconSearch : IconBuilding} size={28} />
      <strong>{filtered ? "No matching institutes" : "No institutes created yet"}</strong>
      <span>
        {filtered
          ? "Change the search or filter to see other institutes."
          : "Use Add institute to create a standalone institute or a group of institutes."}
      </span>
    </div>
  );
}

export default function ManagerPanel({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [structureKind, setStructureKind] = useState("single");
  const [structureName, setStructureName] = useState("");
  const [initialInstituteName, setInitialInstituteName] = useState("");
  const [structureBusy, setStructureBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [childDrafts, setChildDrafts] = useState({});
  const [childBusy, setChildBusy] = useState("");
  const [inviteBusy, setInviteBusy] = useState("");
  const [inviteLinks, setInviteLinks] = useState({});

  const adminUrl = getAdminAppUrl();
  const teacherUrl = getTeacherAppUrl();

  const loadDashboard = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setRefreshing(quiet);
    setError("");
    try {
      const nextDashboard = await getManagerDashboard();
      setDashboard(nextDashboard);
    } catch (loadError) {
      setError(loadError?.message || "Manager data could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!createOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = event => {
      if (event.key === "Escape" && !structureBusy) setCreateOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createOpen, structureBusy]);

  const totals = dashboard?.totals || {
    topLevelInstitutes: 0,
    groups: 0,
    institutes: 0,
    admins: 0,
    teachers: 0,
  };
  const groups = dashboard?.groups || [];
  const managerName = user?.displayName || user?.email || "Manager";
  const topLevelInstitutes = Number(totals.topLevelInstitutes ?? groups.length);
  const selectedGroup = groups.find(group => group.id === selectedGroupId) || null;

  useEffect(() => {
    if (selectedGroupId && !selectedGroup) setSelectedGroupId("");
  }, [selectedGroup, selectedGroupId]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...groups]
      .filter(group => directoryFilter !== "groups" || group.kind === "group")
      .filter(group => !query || String(group.name || "").toLowerCase().includes(query))
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, {
          sensitivity: "base",
          numeric: true,
        })
      );
  }, [directoryFilter, groups, search]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const pagedGroups = filteredGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filteredGroups.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredGroups.length);

  useEffect(() => {
    setPage(1);
  }, [directoryFilter, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleDetailInstitutes = useMemo(() => {
    if (!selectedGroup) return [];
    const query = detailSearch.trim().toLowerCase();
    return (selectedGroup.institutes || []).filter(institute => {
      if (!query) return true;
      return [institute.name, institute.instituteCode]
        .some(value => String(value || "").toLowerCase().includes(query));
    });
  }, [detailSearch, selectedGroup]);

  function openCreateModal() {
    setStructureKind("single");
    setStructureName("");
    setInitialInstituteName("");
    setModalError("");
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (structureBusy) return;
    setCreateOpen(false);
    setModalError("");
  }

  async function createStructure(event) {
    event.preventDefault();
    const name = structureName.trim();
    if (!name || structureBusy) return;
    setStructureBusy(true);
    setModalError("");
    setError("");
    setNotice("");
    try {
      await createGroupStructure({
        name,
        kind: structureKind,
        initialInstituteNames: structureKind === "group" && initialInstituteName.trim()
          ? [initialInstituteName.trim()]
          : [],
      }, user.uid);
      setCreateOpen(false);
      setNotice(structureKind === "single"
        ? `Institute "${name}" created.`
        : `Group "${name}" created.`);
      await loadDashboard({ quiet: true });
    } catch (createError) {
      setModalError(createError?.message || "The institute could not be created.");
    } finally {
      setStructureBusy(false);
    }
  }

  async function createChildInstitute(group) {
    const name = String(childDrafts[group.id] || "").trim();
    if (!name || childBusy) return;
    setChildBusy(group.id);
    setError("");
    setNotice("");
    try {
      await createTenantInstitute({ groupId: group.id, name }, user.uid);
      setChildDrafts(current => ({ ...current, [group.id]: "" }));
      setNotice(`Institute "${name}" created under ${group.name}.`);
      await loadDashboard({ quiet: true });
    } catch (createError) {
      setError(createError?.message || "The institute could not be created.");
    } finally {
      setChildBusy("");
    }
  }

  async function createGroupAdminInvite(group) {
    setInviteBusy(group.id);
    setError("");
    setNotice("");
    try {
      const token = await createScopedInvite({
        inviteType: "group_admin",
        groupId: group.id,
        createdBy: user.uid,
      });
      const link = new URL(adminUrl);
      link.searchParams.set("invite", token);
      setInviteLinks(current => ({ ...current, [group.id]: link.toString() }));
    } catch (inviteError) {
      setError(inviteError?.message || "The invite link could not be created.");
    } finally {
      setInviteBusy("");
    }
  }

  async function copyInvite(groupId) {
    const link = inviteLinks[groupId];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Invite link copied.");
    } catch {
      setError("The invite link could not be copied.");
    }
  }

  function openDetails(group) {
    setSelectedGroupId(group.id);
    setDetailSearch("");
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeDetails() {
    setSelectedGroupId("");
    setDetailSearch("");
    setError("");
    setNotice("");
  }

  const detailStats = selectedGroup
    ? selectedGroup.kind === "group"
      ? [
          { label: "Institutes", value: selectedGroup.instituteCount, icon: IconSchool, tone: "blue" },
          { label: "Group Admins", value: selectedGroup.groupAdminCount, icon: IconUserShield, tone: "amber" },
          { label: "Institute Admins", value: selectedGroup.instituteAdminCount, icon: IconShieldCheck },
          { label: "Teachers", value: selectedGroup.teacherCount, icon: IconUsersGroup },
        ]
      : [
          { label: "Admins", value: selectedGroup.groupAdminCount, icon: IconUserShield, tone: "amber" },
          { label: "Institute Admins", value: selectedGroup.instituteAdminCount, icon: IconShieldCheck },
          { label: "Teachers", value: selectedGroup.teacherCount, icon: IconUsersGroup },
        ]
    : [];

  return (
    <div className="manager-shell">
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${C.page}; }
        button, input { font: inherit; }
        .manager-shell { min-height: 100vh; color: ${C.ink}; background: ${C.page}; font-family: Inter, system-ui, sans-serif; }
        .manager-topbar { min-height: 68px; background: ${C.dark}; color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 28px; }
        .manager-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .manager-brand-mark { width: 36px; height: 36px; display: grid; place-items: center; background: #fff; color: ${C.dark}; border-radius: 7px; }
        .manager-brand strong { display: block; font-size: 17px; line-height: 1.2; }
        .manager-brand span { display: block; color: rgba(255,255,255,.62); font-size: 12px; margin-top: 2px; }
        .manager-top-actions { display: flex; align-items: center; gap: 8px; }
        .manager-main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }
        .manager-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
        .manager-heading-copy { min-width: 0; }
        .manager-heading h1 { margin: 0; font-size: 28px; line-height: 1.2; letter-spacing: 0; }
        .manager-heading p { margin: 7px 0 0; color: ${C.muted}; line-height: 1.55; font-size: 14px; }
        .manager-heading-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
        .manager-btn { min-height: 38px; border: 1px solid ${C.border}; background: #fff; color: ${C.ink}; border-radius: 7px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; }
        .manager-btn:hover { border-color: #AEB7C0; }
        .manager-btn:disabled { opacity: .55; cursor: not-allowed; }
        .manager-btn-primary { background: ${C.dark}; border-color: ${C.dark}; color: #fff; }
        .manager-btn-green { background: ${C.green}; border-color: ${C.green}; color: #fff; }
        .manager-btn-quiet { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.15); color: #fff; }
        .manager-icon-btn { width: 38px; padding: 0; flex: 0 0 38px; }
        .manager-alert { border-radius: 7px; padding: 11px 13px; font-size: 13px; line-height: 1.45; margin-bottom: 14px; }
        .manager-alert-error { background: #FDECEC; border: 1px solid #F1C1C1; color: ${C.red}; }
        .manager-alert-success { background: ${C.greenSoft}; border: 1px solid #C9E4D7; color: #185E43; }
        .manager-directory-summary { display: inline-flex; align-items: center; gap: 11px; margin-bottom: 18px; }
        .manager-directory-summary-icon { width: 42px; height: 42px; display: grid; place-items: center; background: ${C.blueSoft}; color: ${C.blue}; border-radius: 7px; }
        .manager-directory-summary strong { display: block; font-size: 24px; line-height: 1; }
        .manager-directory-summary span { display: block; color: ${C.muted}; font-size: 12px; margin-top: 5px; }
        .manager-toolbar { display: grid; grid-template-columns: minmax(240px,1fr) auto auto; align-items: center; gap: 10px; margin-bottom: 12px; }
        .manager-search { position: relative; min-width: 0; }
        .manager-search > svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: ${C.muted}; pointer-events: none; }
        .manager-input { width: 100%; min-height: 40px; border: 1px solid ${C.border}; border-radius: 7px; padding: 9px 11px; color: ${C.ink}; background: #fff; outline: none; }
        .manager-search .manager-input { padding-left: 38px; }
        .manager-input:focus { border-color: ${C.blue}; box-shadow: 0 0 0 3px rgba(40,90,159,.1); }
        .manager-segment { min-height: 40px; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(72px, auto); border: 1px solid ${C.border}; border-radius: 7px; overflow: hidden; background: #fff; }
        .manager-segment button { border: 0; border-right: 1px solid ${C.border}; background: #fff; color: ${C.muted}; font-weight: 700; cursor: pointer; padding: 0 13px; }
        .manager-segment button:last-child { border-right: 0; }
        .manager-segment button.active { background: ${C.blueSoft}; color: ${C.blue}; }
        .manager-directory { border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; background: ${C.surface}; }
        .manager-directory-head { display: grid; grid-template-columns: minmax(220px,1fr) 170px 34px; gap: 16px; padding: 10px 16px; border-bottom: 1px solid ${C.border}; background: #F8FAFC; color: ${C.muted}; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .manager-directory-row { width: 100%; min-height: 66px; border: 0; border-bottom: 1px solid ${C.border}; background: #fff; display: grid; grid-template-columns: minmax(220px,1fr) 170px 34px; gap: 16px; align-items: center; padding: 11px 16px; text-align: left; cursor: pointer; color: ${C.ink}; }
        .manager-directory-row:last-child { border-bottom: 0; }
        .manager-directory-row:hover { background: #FAFBFC; }
        .manager-directory-name { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .manager-directory-icon { width: 38px; height: 38px; display: grid; place-items: center; background: ${C.blueSoft}; color: ${C.blue}; border-radius: 7px; flex: 0 0 auto; }
        .manager-directory-name strong { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 14px; }
        .manager-directory-name small { display: block; color: ${C.muted}; font-size: 12px; margin-top: 4px; }
        .manager-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 6px; background: ${C.blueSoft}; color: ${C.blue}; font-size: 11px; font-weight: 800; margin-left: 8px; vertical-align: middle; }
        .manager-directory-count { color: ${C.muted}; font-size: 13px; }
        .manager-directory-chevron { color: ${C.muted}; display: grid; place-items: center; }
        .manager-pagination { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 12px; border-top: 1px solid ${C.border}; color: ${C.muted}; font-size: 12px; }
        .manager-pagination-actions { display: flex; align-items: center; gap: 8px; }
        .manager-pagination-page { min-width: 78px; text-align: center; font-weight: 700; color: ${C.ink}; }
        .manager-empty { min-height: 220px; padding: 34px 16px; color: ${C.muted}; display: grid; align-content: center; justify-items: center; gap: 7px; text-align: center; background: #fff; }
        .manager-empty strong { color: ${C.ink}; }
        .manager-empty span { max-width: 440px; font-size: 13px; line-height: 1.5; }
        .manager-back { margin-bottom: 14px; }
        .manager-detail-title { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .manager-detail-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); border: 1px solid ${C.border}; border-radius: 8px; background: #fff; margin-bottom: 18px; }
        .manager-detail-stats[data-count="3"] { grid-template-columns: repeat(3,minmax(0,1fr)); }
        .manager-detail-stat { min-height: 86px; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-right: 1px solid ${C.border}; }
        .manager-detail-stat:last-child { border-right: 0; }
        .manager-detail-stat-icon { width: 38px; height: 38px; border-radius: 7px; display: grid; place-items: center; flex: 0 0 auto; }
        .manager-detail-stat strong { display: block; font-size: 21px; line-height: 1; }
        .manager-detail-stat small { display: block; color: ${C.muted}; margin-top: 5px; font-size: 12px; }
        .manager-detail-actions { display: grid; grid-template-columns: minmax(260px,1fr) auto; gap: 10px; align-items: center; margin-bottom: 14px; }
        .manager-inline { display: flex; gap: 8px; align-items: center; }
        .manager-invite { padding: 10px; border: 1px solid #C9D8EC; background: ${C.blueSoft}; border-radius: 7px; display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .manager-invite code { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: ${C.blue}; }
        .manager-detail-section { margin-top: 20px; }
        .manager-detail-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
        .manager-detail-section h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
        .manager-detail-section p { margin: 5px 0 0; color: ${C.muted}; font-size: 13px; }
        .manager-institute-table { border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; background: #fff; }
        .manager-institute-table-head, .manager-institute-row { display: grid; grid-template-columns: minmax(220px,1fr) minmax(160px,.65fr); gap: 18px; align-items: center; padding: 11px 16px; }
        .manager-institute-table-head { background: #F8FAFC; border-bottom: 1px solid ${C.border}; color: ${C.muted}; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .manager-institute-row { min-height: 56px; border-bottom: 1px solid ${C.border}; }
        .manager-institute-row:last-child { border-bottom: 0; }
        .manager-institute-row strong { font-size: 13px; }
        .manager-institute-code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; color: ${C.muted}; font-size: 12px; overflow-wrap: anywhere; }
        .manager-modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(10,22,18,.48); display: grid; place-items: center; padding: 18px; }
        .manager-modal { width: min(520px,100%); max-height: calc(100vh - 36px); overflow-y: auto; background: #fff; border-radius: 8px; box-shadow: 0 22px 60px rgba(10,22,18,.25); }
        .manager-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; border-bottom: 1px solid ${C.border}; }
        .manager-modal-header h2 { margin: 0; font-size: 19px; letter-spacing: 0; }
        .manager-modal-body { padding: 20px; display: grid; gap: 16px; }
        .manager-modal .manager-segment { grid-auto-columns: 1fr; }
        .manager-field label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: ${C.muted}; margin-bottom: 7px; }
        .manager-modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid ${C.border}; background: #FAFBFC; }
        @media (max-width: 760px) {
          .manager-main { width: min(100% - 20px,1180px); padding-top: 20px; }
          .manager-heading { display: block; }
          .manager-heading-actions { margin-top: 14px; }
          .manager-toolbar { grid-template-columns: 1fr auto; }
          .manager-toolbar .manager-search { grid-column: 1 / -1; }
          .manager-directory-head { display: none; }
          .manager-directory-row { grid-template-columns: minmax(0,1fr) 30px; gap: 8px; }
          .manager-directory-count { grid-column: 1 / 2; padding-left: 49px; margin-top: -8px; }
          .manager-directory-chevron { grid-column: 2; grid-row: 1 / span 2; }
          .manager-detail-stats, .manager-detail-stats[data-count="3"] { grid-template-columns: 1fr 1fr; }
          .manager-detail-stat:nth-child(2) { border-right: 0; }
          .manager-detail-stat:nth-child(-n+2) { border-bottom: 1px solid ${C.border}; }
          .manager-detail-stats[data-count="3"] .manager-detail-stat:nth-child(3) { grid-column: 1 / -1; border-right: 0; }
          .manager-detail-actions { grid-template-columns: 1fr; }
          .manager-detail-actions > .manager-btn { width: 100%; }
        }
        @media (max-width: 520px) {
          .manager-topbar { padding: 0 14px; }
          .manager-brand span, .manager-top-actions a { display: none; }
          .manager-heading h1 { font-size: 24px; }
          .manager-heading-actions { width: 100%; }
          .manager-heading-actions .manager-btn:not(.manager-icon-btn) { flex: 1; }
          .manager-toolbar { grid-template-columns: 1fr; }
          .manager-toolbar .manager-search { grid-column: auto; }
          .manager-toolbar .manager-btn { width: 100%; }
          .manager-segment { width: 100%; grid-auto-columns: 1fr; }
          .manager-directory-name strong { white-space: normal; }
          .manager-pagination { align-items: flex-start; flex-direction: column; }
          .manager-pagination-actions { width: 100%; justify-content: space-between; }
          .manager-detail-stats, .manager-detail-stats[data-count="3"] { grid-template-columns: 1fr; }
          .manager-detail-stats[data-count="3"] .manager-detail-stat:nth-child(3) { grid-column: auto; }
          .manager-detail-stat, .manager-detail-stat:nth-child(2) { border-right: 0; border-bottom: 1px solid ${C.border}; }
          .manager-detail-stat:last-child { border-bottom: 0; }
          .manager-inline { flex-direction: column; align-items: stretch; }
          .manager-invite { align-items: stretch; flex-direction: column; }
          .manager-detail-section-head { align-items: stretch; flex-direction: column; }
          .manager-institute-table-head { display: none; }
          .manager-institute-row { grid-template-columns: 1fr; gap: 5px; }
          .manager-modal-footer { align-items: stretch; flex-direction: column-reverse; }
          .manager-modal-footer .manager-btn { width: 100%; }
        }
      `}</style>

      <header className="manager-topbar">
        <div className="manager-brand">
          <div className="manager-brand-mark"><Icon component={IconShieldCheck} size={21} /></div>
          <div>
            <strong>Ledgr Manager</strong>
            <span>Groups, institutes and access</span>
          </div>
        </div>
        <div className="manager-top-actions">
          <a className="manager-btn manager-btn-quiet" href={adminUrl}>
            Admin <Icon component={IconExternalLink} size={15} />
          </a>
          <a className="manager-btn manager-btn-quiet" href={teacherUrl}>
            Teacher <Icon component={IconExternalLink} size={15} />
          </a>
          <button className="manager-btn manager-btn-quiet manager-icon-btn" type="button" onClick={logout} title="Sign out" aria-label="Sign out">
            <Icon component={IconLogout} size={17} />
          </button>
        </div>
      </header>

      <main className="manager-main">
        {selectedGroup ? (
          <>
            <button className="manager-btn manager-back" type="button" onClick={closeDetails}>
              <Icon component={IconArrowLeft} size={16} /> Back to institutes
            </button>

            <div className="manager-heading">
              <div className="manager-heading-copy">
                <div className="manager-detail-title">
                  <h1>{selectedGroup.name}</h1>
                  {selectedGroup.kind === "group" && <span className="manager-badge">Group</span>}
                </div>
                <p>
                  {selectedGroup.kind === "group"
                    ? "Manage its institutes, access and Group Admin invitations."
                    : "Manage this institute and its top-level Admin invitations."}
                </p>
              </div>
              <div className="manager-heading-actions">
                <button className="manager-btn" type="button" onClick={() => loadDashboard({ quiet: true })} disabled={refreshing}>
                  <Icon component={IconRefresh} size={16} /> {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>

            {error && <div className="manager-alert manager-alert-error">{error}</div>}
            {notice && <div className="manager-alert manager-alert-success">{notice}</div>}

            <div className="manager-detail-stats" data-count={detailStats.length}>
              {detailStats.map(stat => <DetailStat key={stat.label} {...stat} />)}
            </div>

            <div className="manager-detail-actions">
              {selectedGroup.kind === "group" ? (
                <div className="manager-inline">
                  <input
                    className="manager-input"
                    value={childDrafts[selectedGroup.id] || ""}
                    onChange={event => setChildDrafts(current => ({
                      ...current,
                      [selectedGroup.id]: event.target.value,
                    }))}
                    placeholder="New institute name"
                    aria-label="New institute name"
                  />
                  <button
                    className="manager-btn manager-btn-green"
                    type="button"
                    onClick={() => createChildInstitute(selectedGroup)}
                    disabled={!String(childDrafts[selectedGroup.id] || "").trim() || childBusy === selectedGroup.id}
                  >
                    <Icon component={IconPlus} size={16} />
                    {childBusy === selectedGroup.id ? "Adding" : "Add institute"}
                  </button>
                </div>
              ) : <div />}
              <button
                className="manager-btn manager-btn-primary"
                type="button"
                onClick={() => createGroupAdminInvite(selectedGroup)}
                disabled={inviteBusy === selectedGroup.id}
              >
                <Icon component={IconLink} size={16} />
                {inviteBusy === selectedGroup.id
                  ? "Generating"
                  : selectedGroup.kind === "group"
                    ? "Invite Group Admin"
                    : "Invite Admin"}
              </button>
            </div>

            {inviteLinks[selectedGroup.id] && (
              <div className="manager-invite">
                <Icon component={IconLink} size={16} />
                <code>{inviteLinks[selectedGroup.id]}</code>
                <button className="manager-btn" type="button" onClick={() => copyInvite(selectedGroup.id)}>
                  <Icon component={IconCopy} size={15} /> Copy
                </button>
              </div>
            )}

            <section className="manager-detail-section">
              <div className="manager-detail-section-head">
                <div>
                  <h2>{selectedGroup.kind === "group" ? "Institutes" : "Institute"}</h2>
                  <p>Private Institute IDs are used for teacher join requests.</p>
                </div>
                {selectedGroup.instituteCount > 1 && (
                  <div className="manager-search">
                    <Icon component={IconSearch} size={16} />
                    <input
                      className="manager-input"
                      value={detailSearch}
                      onChange={event => setDetailSearch(event.target.value)}
                      placeholder="Search institutes"
                      aria-label="Search institutes"
                    />
                  </div>
                )}
              </div>

              <div className="manager-institute-table">
                <div className="manager-institute-table-head">
                  <span>Institute name</span>
                  <span>Private Institute ID</span>
                </div>
                {visibleDetailInstitutes.length ? visibleDetailInstitutes.map(institute => (
                  <div className="manager-institute-row" key={institute.id}>
                    <strong>{institute.name}</strong>
                    <span className="manager-institute-code">{institute.instituteCode || "Not generated"}</span>
                  </div>
                )) : (
                  <EmptyDirectory filtered={!!detailSearch.trim()} />
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="manager-heading">
              <div className="manager-heading-copy">
                <h1>Institutes</h1>
                <p>Signed in as {managerName}. Open an institute to manage its structure and access.</p>
              </div>
              <div className="manager-heading-actions">
                <button
                  className="manager-btn manager-icon-btn"
                  type="button"
                  onClick={() => loadDashboard({ quiet: true })}
                  disabled={refreshing}
                  title="Refresh institutes"
                  aria-label="Refresh institutes"
                >
                  <Icon component={IconRefresh} size={17} />
                </button>
              </div>
            </div>

            {error && <div className="manager-alert manager-alert-error">{error}</div>}
            {notice && <div className="manager-alert manager-alert-success">{notice}</div>}

            <div className="manager-directory-summary">
              <span className="manager-directory-summary-icon">
                <Icon component={IconSchool} size={20} />
              </span>
              <span>
                <strong>{loading ? "..." : topLevelInstitutes}</strong>
                <span>Total institutes</span>
              </span>
            </div>

            <div className="manager-toolbar">
              <div className="manager-search">
                <Icon component={IconSearch} size={16} />
                <input
                  className="manager-input"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search institutes"
                  aria-label="Search institutes"
                />
              </div>
              <div className="manager-segment" aria-label="Institute filter">
                <button
                  type="button"
                  className={directoryFilter === "all" ? "active" : ""}
                  onClick={() => setDirectoryFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={directoryFilter === "groups" ? "active" : ""}
                  onClick={() => setDirectoryFilter("groups")}
                >
                  Groups
                </button>
              </div>
              <button className="manager-btn manager-btn-primary" type="button" onClick={openCreateModal}>
                <Icon component={IconPlus} size={16} /> Add institute
              </button>
            </div>

            <section className="manager-directory" aria-label="Institute directory">
              <div className="manager-directory-head">
                <span>Institute</span>
                <span>Structure</span>
                <span />
              </div>
              {loading ? (
                <div className="manager-empty"><span>Loading institutes...</span></div>
              ) : pagedGroups.length ? (
                pagedGroups.map(group => (
                  <button
                    className="manager-directory-row"
                    type="button"
                    key={group.id}
                    onClick={() => openDetails(group)}
                  >
                    <span className="manager-directory-name">
                      <span className="manager-directory-icon">
                        <Icon component={group.kind === "group" ? IconBuilding : IconSchool} size={19} />
                      </span>
                      <span>
                        <strong>
                          {group.name}
                          {group.kind === "group" && <span className="manager-badge">Group</span>}
                        </strong>
                        {group.kind === "group" && <small>Contains multiple institutes</small>}
                      </span>
                    </span>
                    <span className="manager-directory-count">
                      {group.kind === "group"
                        ? `${group.instituteCount} institute${group.instituteCount === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <span className="manager-directory-chevron">
                      <Icon component={IconChevronRight} size={18} />
                    </span>
                  </button>
                ))
              ) : <EmptyDirectory filtered={!!search.trim() || directoryFilter !== "all"} />}

              {!loading && filteredGroups.length > 0 && (
                <div className="manager-pagination">
                  <span>Showing {rangeStart}-{rangeEnd} of {filteredGroups.length}</span>
                  <span className="manager-pagination-actions">
                    <button
                      className="manager-btn manager-icon-btn"
                      type="button"
                      onClick={() => setPage(current => Math.max(1, current - 1))}
                      disabled={page <= 1}
                      title="Previous page"
                      aria-label="Previous page"
                    >
                      <Icon component={IconChevronLeft} size={17} />
                    </button>
                    <span className="manager-pagination-page">Page {page} of {totalPages}</span>
                    <button
                      className="manager-btn manager-icon-btn"
                      type="button"
                      onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                      title="Next page"
                      aria-label="Next page"
                    >
                      <Icon component={IconChevronRight} size={17} />
                    </button>
                  </span>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {createOpen && (
        <div className="manager-modal-backdrop" onMouseDown={closeCreateModal}>
          <form
            className="manager-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-create-title"
            onSubmit={createStructure}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="manager-modal-header">
              <h2 id="manager-create-title">Add institute</h2>
              <button
                className="manager-btn manager-icon-btn"
                type="button"
                onClick={closeCreateModal}
                disabled={structureBusy}
                title="Close"
                aria-label="Close"
              >
                <Icon component={IconX} size={17} />
              </button>
            </div>

            <div className="manager-modal-body">
              {modalError && <div className="manager-alert manager-alert-error">{modalError}</div>}
              <div className="manager-field">
                <label>Structure type</label>
                <div className="manager-segment">
                  <button
                    type="button"
                    className={structureKind === "single" ? "active" : ""}
                    onClick={() => {
                      setStructureKind("single");
                      setModalError("");
                    }}
                  >
                    Single institute
                  </button>
                  <button
                    type="button"
                    className={structureKind === "group" ? "active" : ""}
                    onClick={() => {
                      setStructureKind("group");
                      setModalError("");
                    }}
                  >
                    Group of institutes
                  </button>
                </div>
              </div>

              <div className="manager-field">
                <label>{structureKind === "single" ? "Institute name" : "Group name"}</label>
                <input
                  className="manager-input"
                  value={structureName}
                  onChange={event => setStructureName(event.target.value)}
                  placeholder={structureKind === "single" ? "e.g. Northfield Academy" : "e.g. Genesis Group"}
                  autoFocus
                />
              </div>

              {structureKind === "group" && (
                <div className="manager-field">
                  <label>Initial institute (optional)</label>
                  <input
                    className="manager-input"
                    value={initialInstituteName}
                    onChange={event => setInitialInstituteName(event.target.value)}
                    placeholder="e.g. Main Branch"
                  />
                </div>
              )}
            </div>

            <div className="manager-modal-footer">
              <button className="manager-btn" type="button" onClick={closeCreateModal} disabled={structureBusy}>
                Cancel
              </button>
              <button className="manager-btn manager-btn-primary" type="submit" disabled={!structureName.trim() || structureBusy}>
                <Icon component={IconPlus} size={16} />
                {structureBusy
                  ? "Creating"
                  : structureKind === "single"
                    ? "Create institute"
                    : "Create group"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

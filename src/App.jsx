import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

const STAFF = [
  { name: "Maria G.",  role: "Head Housekeeper",  color: "#7C5CBF", initials: "MG" },
  { name: "James T.",  role: "Housekeeper",        color: "#2E86AB", initials: "JT" },
  { name: "Priya S.",  role: "Laundry Specialist", color: "#D4845A", initials: "PS" },
  { name: "Carlos M.", role: "Housekeeper",         color: "#3BAA73", initials: "CM" },
  { name: "Aisha K.",  role: "Housekeeper",         color: "#C75B7A", initials: "AK" },
];
const STAFF_NAMES = STAFF.map(s => s.name);

const TASK_TEMPLATES = [
  { label: "Room Cleaning",       icon: "🧹" },
  { label: "Sheet Change",        icon: "🛏️" },
  { label: "Laundry",             icon: "🫧" },
  { label: "Towel Refresh",       icon: "🪣" },
  { label: "Bathroom Deep Clean", icon: "🚿" },
  { label: "Trash Removal",       icon: "🗑️" },
  { label: "Restocking",          icon: "📦" },
  { label: "Inspection",          icon: "✅" },
];

const PRIORITIES      = ["Low", "Normal", "Urgent"];
const PRIORITY_COLORS = { Low: "#7EC8A4", Normal: "#F5C842", Urgent: "#E8553E" };
const STATUS_ORDER    = ["pending", "in-progress", "done"];
const STATUS_LABELS   = { pending: "Pending", "in-progress": "In Progress", done: "Done" };
const STATUS_ICONS    = { pending: "⏳", "in-progress": "🔄", done: "✔" };

const HOURS   = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
const fmtHour = h => h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h-12}pm`;

function generateId() { return Math.random().toString(36).slice(2, 9); }

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getWeekDates(anchor) {
  const d = new Date(anchor);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d); dd.setDate(d.getDate() + i); return dd;
  });
}

function timeAgo(date) {
  if (!date) return "";
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

function staffColor(name)    { return STAFF.find(s => s.name === name)?.color    || "#888"; }
function staffInitials(name) { return STAFF.find(s => s.name === name)?.initials || name.slice(0,2).toUpperCase(); }

function rowToTask(row) {
  return {
    id:            row.id,
    title:         row.title,
    icon:          row.icon,
    room:          row.room,
    assignee:      row.assignee,
    priority:      row.priority,
    status:        row.status,
    scheduledDate: row.scheduled_date,
    notes:         row.notes || "",
    createdAt:     row.created_at,
    startedAt:     row.started_at,
    completedAt:   row.completed_at,
  };
}

function taskToRow(t) {
  return {
    id:             t.id,
    title:          t.title,
    icon:           t.icon,
    room:           t.room,
    assignee:       t.assignee,
    priority:       t.priority,
    status:         t.status,
    scheduled_date: t.scheduledDate,
    notes:          t.notes,
    created_at:     t.createdAt,
    started_at:     t.startedAt    || null,
    completed_at:   t.completedAt  || null,
  };
}

function rowsToShifts(rows) {
  const shifts = {};
  STAFF.forEach(s => { shifts[s.name] = {}; });
  rows.forEach(r => {
    if (!shifts[r.staff_name]) shifts[r.staff_name] = {};
    shifts[r.staff_name][r.shift_date] = { start: r.start_hour, end: r.end_hour };
  });
  return shifts;
}

const today    = new Date();
const todayStr = toDateStr(today);
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --bg:#F5F0E8; --surface:#FDFAF4; --border:#D9D2C5;
    --text:#1C1916; --muted:#7A7168; --accent:#2B4C3F;
    --accent-light:#E8F0EC; --pending:#E8DCC8; --in-progress:#C8DCE8; --done:#C8E8D6;
  }
  body { background:var(--bg); font-family:'DM Sans',sans-serif; color:var(--text); min-height:100vh; }
  .app { max-width:1380px; margin:0 auto; padding:24px 16px; }
  .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px; gap:16px; flex-wrap:wrap; }
  .header-left h1 { font-family:'DM Serif Display',serif; font-size:2.2rem; color:var(--accent); line-height:1.1; }
  .header-left p { color:var(--muted); font-size:0.9rem; margin-top:4px; }
  .add-btn { background:var(--accent); color:#fff; border:none; padding:11px 20px; font-family:'DM Sans',sans-serif; font-size:0.88rem; font-weight:600; border-radius:8px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; gap:7px; white-space:nowrap; }
  .add-btn:hover { background:#1e3a2e; transform:translateY(-1px); }
  .tabs { display:flex; margin-bottom:24px; border:1.5px solid var(--border); border-radius:10px; overflow:hidden; width:fit-content; }
  .tab { padding:9px 20px; font-family:'DM Sans',sans-serif; font-size:0.87rem; font-weight:500; background:var(--surface); border:none; cursor:pointer; color:var(--muted); transition:all 0.12s; border-right:1.5px solid var(--border); }
  .tab:last-child { border-right:none; }
  .tab.active { background:var(--accent); color:#fff; font-weight:600; }
  .stats-bar { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  .stat { background:var(--surface); border:1.5px solid var(--border); border-radius:10px; padding:12px 18px; flex:1; min-width:90px; }
  .stat-num { font-family:'DM Serif Display',serif; font-size:1.6rem; color:var(--accent); }
  .stat-label { font-size:0.75rem; color:var(--muted); font-weight:500; margin-top:2px; }
  .filters { display:flex; gap:8px; margin-bottom:22px; flex-wrap:wrap; align-items:center; }
  .filter-btn { padding:6px 14px; border-radius:20px; border:1.5px solid var(--border); background:var(--surface); font-family:'DM Sans',sans-serif; font-size:0.82rem; cursor:pointer; color:var(--muted); transition:all 0.12s; }
  .filter-btn.active { border-color:var(--accent); background:var(--accent-light); color:var(--accent); font-weight:600; }
  .filter-label { font-size:0.8rem; color:var(--muted); font-weight:500; }
  .board { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  @media(max-width:768px){ .board { grid-template-columns:1fr; } }
  .column { background:var(--surface); border-radius:14px; border:1.5px solid var(--border); overflow:hidden; }
  .column-header { padding:13px 17px; display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid var(--border); }
  .column-header.pending { background:var(--pending); }
  .column-header.in-progress { background:var(--in-progress); }
  .column-header.done { background:var(--done); }
  .col-title { font-family:'DM Serif Display',serif; font-size:1.1rem; display:flex; align-items:center; gap:8px; }
  .col-count { background:rgba(0,0,0,0.12); border-radius:20px; padding:2px 9px; font-size:0.75rem; font-weight:600; font-family:'DM Sans',sans-serif; }
  .tasks { padding:14px; display:flex; flex-direction:column; gap:10px; min-height:100px; }
  .task-card { background:#fff; border-radius:10px; border:1.5px solid var(--border); padding:13px; transition:all 0.15s; }
  .task-card:hover { border-color:var(--accent); transform:translateY(-1px); box-shadow:0 4px 12px rgba(43,76,63,0.1); }
  .task-top { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
  .task-icon { font-size:1.15rem; }
  .task-title { font-weight:600; font-size:0.87rem; flex:1; }
  .priority-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .task-room { font-size:0.79rem; color:var(--muted); margin-bottom:5px; }
  .task-meta { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px; }
  .task-assignee { font-size:0.74rem; border-radius:12px; padding:2px 8px; font-weight:600; color:#fff; }
  .task-time { font-size:0.71rem; color:var(--muted); }
  .task-actions { display:flex; gap:6px; margin-top:9px; border-top:1px solid var(--border); padding-top:9px; }
  .task-btn { flex:1; padding:5px 9px; border-radius:6px; border:1.5px solid var(--border); background:none; font-family:'DM Sans',sans-serif; font-size:0.74rem; font-weight:600; cursor:pointer; transition:all 0.12s; color:var(--muted); }
  .task-btn.start { border-color:#C8DCE8; color:#1a5c8a; } .task-btn.start:hover { background:#C8DCE8; }
  .task-btn.complete { border-color:#C8E8D6; color:#1a6b3a; } .task-btn.complete:hover { background:#C8E8D6; }
  .task-btn.undo:hover { background:var(--bg); }
  .task-btn.delete { color:#c0392b; border-color:#f5c6c2; } .task-btn.delete:hover { background:#fdecea; }
  .empty { text-align:center; color:var(--muted); font-size:0.85rem; padding:20px; }
  .week-nav { display:flex; align-items:center; gap:10px; margin-bottom:18px; flex-wrap:wrap; }
  .week-nav-btn { padding:7px 14px; border-radius:8px; border:1.5px solid var(--border); background:var(--surface); font-family:'DM Sans',sans-serif; font-size:0.84rem; cursor:pointer; color:var(--text); transition:all 0.12s; font-weight:500; }
  .week-nav-btn:hover { border-color:var(--accent); background:var(--accent-light); color:var(--accent); }
  .week-nav-btn.today-btn { background:var(--accent); color:#fff; border-color:var(--accent); }
  .week-nav-btn.today-btn:hover { background:#1e3a2e; }
  .week-range { font-family:'DM Serif Display',serif; font-size:1.2rem; color:var(--accent); }
  .week-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:10px; }
  @media(max-width:1000px){ .week-grid { grid-template-columns:repeat(4,1fr); } }
  @media(max-width:600px){ .week-grid { grid-template-columns:repeat(2,1fr); } }
  .day-col { background:var(--surface); border:1.5px solid var(--border); border-radius:12px; overflow:hidden; min-height:160px; }
  .day-col.is-today { border-color:var(--accent); box-shadow:0 0 0 1.5px var(--accent); }
  .day-header { padding:10px 12px; border-bottom:1.5px solid var(--border); }
  .day-col.is-today .day-header { background:var(--accent); }
  .day-name { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); margin-bottom:2px; }
  .day-col.is-today .day-name { color:rgba(255,255,255,0.65); }
  .day-num { font-family:'DM Serif Display',serif; font-size:1.45rem; color:var(--text); line-height:1; }
  .day-col.is-today .day-num { color:#fff; }
  .day-month { font-size:0.72rem; color:var(--muted); margin-top:1px; }
  .day-col.is-today .day-month { color:rgba(255,255,255,0.6); }
  .day-task-count { font-size:0.68rem; color:var(--muted); margin-top:3px; font-weight:500; }
  .day-col.is-today .day-task-count { color:rgba(255,255,255,0.6); }
  .day-tasks { padding:8px; display:flex; flex-direction:column; gap:5px; }
  .sched-chip { border-radius:7px; padding:7px 9px; border:1.5px solid var(--border); background:#fff; transition:all 0.12s; }
  .sched-chip:hover { border-color:var(--accent); transform:translateY(-1px); box-shadow:0 3px 8px rgba(43,76,63,0.09); }
  .sched-chip.status-done { background:#f0faf4; border-color:#b0dfc0; }
  .sched-chip.status-in-progress { background:#f0f6fb; border-color:#b0cfe0; }
  .sched-top { display:flex; align-items:center; gap:5px; margin-bottom:3px; }
  .sched-ico { font-size:0.9rem; }
  .sched-ttl { font-size:0.76rem; font-weight:600; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sched-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .sched-meta { display:flex; justify-content:space-between; align-items:center; gap:4px; }
  .sched-room { font-size:0.67rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sched-who { font-size:0.66rem; border-radius:10px; padding:1px 6px; font-weight:600; white-space:nowrap; color:#fff; }
  .sched-actions { display:flex; gap:4px; margin-top:6px; border-top:1px solid var(--border); padding-top:5px; }
  .sched-btn { flex:1; padding:4px 5px; border-radius:5px; border:1.5px solid var(--border); background:none; font-family:'DM Sans',sans-serif; font-size:0.67rem; font-weight:600; cursor:pointer; transition:all 0.12s; color:var(--muted); }
  .sched-btn.start { border-color:#C8DCE8; color:#1a5c8a; } .sched-btn.start:hover { background:#C8DCE8; }
  .sched-btn.complete { border-color:#C8E8D6; color:#1a6b3a; } .sched-btn.complete:hover { background:#C8E8D6; }
  .sched-btn.undo:hover { background:var(--bg); }
  .sched-btn.delete { color:#c0392b; border-color:#f5c6c2; } .sched-btn.delete:hover { background:#fdecea; }
  .add-day-btn { width:100%; font-size:0.7rem; color:var(--accent); background:none; border:1.5px dashed var(--border); border-radius:6px; padding:5px 8px; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:2px; transition:all 0.12s; }
  .add-day-btn:hover { border-color:var(--accent); background:var(--accent-light); }
  .day-empty-msg { font-size:0.75rem; color:var(--muted); text-align:center; padding:14px 6px 10px; }
  .overview-wrap { overflow-x:auto; }
  .ov-grid { display:grid; min-width:900px; }
  .ov-header-row { display:grid; grid-template-columns:180px repeat(7,1fr); border-bottom:2px solid var(--border); position:sticky; top:0; z-index:10; background:var(--bg); }
  .ov-header-corner { padding:10px 14px; display:flex; align-items:flex-end; font-size:0.75rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; }
  .ov-day-head { padding:10px 8px 8px; text-align:center; border-left:1px solid var(--border); }
  .ov-day-head.is-today { background:var(--accent-light); border-radius:8px 8px 0 0; }
  .ov-day-wday { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--muted); }
  .ov-day-head.is-today .ov-day-wday { color:var(--accent); }
  .ov-day-date { font-family:'DM Serif Display',serif; font-size:1.3rem; color:var(--text); line-height:1.1; }
  .ov-day-head.is-today .ov-day-date { color:var(--accent); }
  .ov-day-sub { font-size:0.68rem; color:var(--muted); margin-top:1px; }
  .ov-staff-row { display:grid; grid-template-columns:180px repeat(7,1fr); border-bottom:1px solid var(--border); min-height:80px; }
  .ov-staff-row:last-child { border-bottom:none; }
  .ov-staff-row:nth-child(even) { background:rgba(0,0,0,0.015); }
  .ov-staff-cell { padding:12px 14px; display:flex; align-items:center; gap:10px; border-right:1px solid var(--border); position:sticky; left:0; background:var(--surface); z-index:5; }
  .ov-avatar { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700; color:#fff; flex-shrink:0; }
  .ov-staff-name { font-size:0.84rem; font-weight:600; color:var(--text); }
  .ov-staff-role { font-size:0.7rem; color:var(--muted); margin-top:1px; }
  .ov-day-cell { border-left:1px solid var(--border); padding:6px; display:flex; flex-direction:column; gap:4px; position:relative; min-height:80px; cursor:pointer; transition:background 0.1s; }
  .ov-day-cell:hover { background:var(--accent-light); }
  .ov-day-cell.is-today { background:rgba(43,76,63,0.03); }
  .ov-day-cell.is-today:hover { background:var(--accent-light); }
  .ov-day-cell.off { background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,0.025) 4px,rgba(0,0,0,0.025) 8px); }
  .ov-day-cell.off:hover { background:var(--accent-light); }
  .ov-shift-bar { border-radius:6px; padding:5px 8px; display:flex; align-items:center; justify-content:space-between; gap:4px; font-size:0.72rem; font-weight:600; color:#fff; opacity:0.92; }
  .ov-shift-time { font-size:0.68rem; opacity:0.85; white-space:nowrap; }
  .ov-shift-hrs { font-size:0.72rem; font-weight:700; }
  .ov-task-pills { display:flex; flex-wrap:wrap; gap:3px; margin-top:2px; }
  .ov-task-pill { font-size:0.64rem; padding:2px 6px; border-radius:10px; font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:3px; }
  .ov-task-pill.status-pending { background:#E8DCC8; color:#6b5a3e; }
  .ov-task-pill.status-in-progress { background:#C8DCE8; color:#1a4a6e; }
  .ov-task-pill.status-done { background:#C8E8D6; color:#1a5030; }
  .ov-off-badge { font-size:0.7rem; color:var(--muted); text-align:center; padding:20px 0 0; opacity:0.5; }
  .ov-add-shift { font-size:0.68rem; color:var(--muted); border:1.5px dashed var(--border); background:none; border-radius:5px; padding:3px 6px; cursor:pointer; font-family:'DM Sans',sans-serif; width:100%; margin-top:auto; transition:all 0.12s; }
  .ov-add-shift:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-light); }
  .ov-totals-row { display:grid; grid-template-columns:180px repeat(7,1fr); border-top:2px solid var(--border); background:var(--surface); border-radius:0 0 12px 12px; }
  .ov-total-label { padding:10px 14px; font-size:0.75rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; display:flex; align-items:center; }
  .ov-total-cell { padding:10px 8px; border-left:1px solid var(--border); text-align:center; }
  .ov-total-num { font-family:'DM Serif Display',serif; font-size:1.1rem; color:var(--accent); }
  .ov-total-sub { font-size:0.66rem; color:var(--muted); }
  .ov-legend { display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap; align-items:center; }
  .ov-legend-item { display:flex; align-items:center; gap:5px; font-size:0.75rem; color:var(--muted); }
  .ov-legend-swatch { width:12px; height:12px; border-radius:3px; }
  .loading-bar { text-align:center; padding:60px 20px; font-family:'DM Serif Display',serif; font-size:1.4rem; color:var(--accent); }
  .error-banner { background:#fdecea; border:1.5px solid #f5c6c2; border-radius:10px; padding:14px 18px; color:#c0392b; font-size:0.86rem; margin-bottom:20px; }
  .sync-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:#3BAA73; margin-right:6px; animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .overlay { position:fixed; inset:0; background:rgba(20,15,10,0.45); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; animation:fadeIn 0.15s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal { background:var(--surface); border-radius:16px; width:100%; max-width:500px; box-shadow:0 20px 60px rgba(0,0,0,0.22); animation:slideUp 0.2s ease; overflow:hidden; max-height:90vh; display:flex; flex-direction:column; }
  @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
  .modal-header { padding:20px 24px 16px; border-bottom:1.5px solid var(--border); flex-shrink:0; }
  .modal-header h2 { font-family:'DM Serif Display',serif; font-size:1.4rem; color:var(--accent); }
  .modal-header p { font-size:0.82rem; color:var(--muted); margin-top:4px; }
  .modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
  .modal-footer { padding:16px 24px; border-top:1.5px solid var(--border); display:flex; gap:10px; justify-content:flex-end; flex-shrink:0; }
  .form-group { display:flex; flex-direction:column; gap:5px; }
  .form-group label { font-size:0.79rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; }
  .form-group input, .form-group select { padding:9px 12px; border-radius:8px; border:1.5px solid var(--border); font-family:'DM Sans',sans-serif; font-size:0.9rem; background:#fff; color:var(--text); outline:none; transition:border-color 0.12s; }
  .form-group input:focus, .form-group select:focus { border-color:var(--accent); }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .template-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
  .template-chip { padding:9px 7px; border-radius:8px; border:1.5px solid var(--border); background:#fff; text-align:center; cursor:pointer; font-size:0.73rem; font-family:'DM Sans',sans-serif; transition:all 0.12s; color:var(--text); }
  .template-chip:hover, .template-chip.selected { border-color:var(--accent); background:var(--accent-light); color:var(--accent); }
  .template-chip span { display:block; font-size:1.2rem; margin-bottom:3px; }
  .cancel-btn { padding:10px 18px; border-radius:8px; border:1.5px solid var(--border); background:none; font-family:'DM Sans',sans-serif; font-size:0.9rem; cursor:pointer; color:var(--muted); }
  .cancel-btn:hover { background:var(--bg); }
  .save-btn { padding:10px 22px; border-radius:8px; border:none; background:var(--accent); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; transition:background 0.15s; }
  .save-btn:hover { background:#1e3a2e; }
  .save-btn:disabled { background:var(--border); color:var(--muted); cursor:not-allowed; }
  .danger-btn { padding:10px 18px; border-radius:8px; border:1.5px solid #f5c6c2; background:none; font-family:'DM Sans',sans-serif; font-size:0.9rem; cursor:pointer; color:#c0392b; margin-right:auto; }
  .danger-btn:hover { background:#fdecea; }
`;
export default function App() {
  const [tasks,          setTasks]          = useState([]);
  const [shifts,         setShifts]         = useState({});
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [tab,            setTab]            = useState("overview");
  const [filterStaff,    setFilterStaff]    = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [weekAnchor,     setWeekAnchor]     = useState(new Date());
  const [showTaskModal,  setShowTaskModal]  = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftEdit,      setShiftEdit]      = useState(null);
  const [saving,         setSaving]         = useState(false);

  const emptyForm = { title:"", icon:"🧹", room:"", assignee:"", priority:"Normal", notes:"", scheduledDate:todayStr, selectedTemplate:null };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [{ data: taskRows, error: tErr }, { data: shiftRows, error: sErr }] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("shifts").select("*"),
      ]);
      if (tErr) throw tErr;
      if (sErr) throw sErr;
      setTasks((taskRows || []).map(rowToTask));
      setShifts(rowsToShifts(shiftRows || []));
    } catch (e) {
      setError(e.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const taskChannel = supabase.channel("tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, payload => {
        if (payload.eventType === "INSERT") setTasks(prev => [rowToTask(payload.new), ...prev]);
        else if (payload.eventType === "UPDATE") setTasks(prev => prev.map(t => t.id === payload.new.id ? rowToTask(payload.new) : t));
        else if (payload.eventType === "DELETE") setTasks(prev => prev.filter(t => t.id !== payload.old.id));
      }).subscribe();
    const shiftChannel = supabase.channel("shifts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => {
        supabase.from("shifts").select("*").then(({ data }) => { if (data) setShifts(rowsToShifts(data)); });
      }).subscribe();
    return () => { supabase.removeChannel(taskChannel); supabase.removeChannel(shiftChannel); };
  }, []);

  async function moveTask(id, to) {
    const now = new Date().toISOString();
    const task = tasks.find(t => t.id === id);
    const updates = { status: to, started_at: to === "in-progress" && !task.startedAt ? now : task.startedAt || null, completed_at: to === "done" ? now : null };
    setTasks(prev => prev.map(t => t.id !== id ? t : { ...t, status: to, startedAt: updates.started_at, completedAt: updates.completed_at }));
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) { setError(error.message); loadData(); }
  }

  async function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { setError(error.message); loadData(); }
  }

  function openTaskModal(prefillDate, prefillAssignee) {
    setForm({ ...emptyForm, scheduledDate: prefillDate || todayStr, assignee: prefillAssignee || "" });
    setShowTaskModal(true);
  }
  function selectTemplate(tmpl) { setForm(f => ({ ...f, title: tmpl.label, icon: tmpl.icon, selectedTemplate: tmpl.label })); }

  async function saveTask() {
    if (!form.title || !form.room || !form.assignee) return;
    setSaving(true);
    const newTask = { id: generateId(), title: form.title, icon: form.icon, room: form.room, assignee: form.assignee, priority: form.priority, status: "pending", scheduledDate: form.scheduledDate, createdAt: new Date().toISOString(), startedAt: null, completedAt: null, notes: form.notes };
    setShowTaskModal(false);
    setTasks(prev => [newTask, ...prev]);
    const { error } = await supabase.from("tasks").insert(taskToRow(newTask));
    if (error) { setError(error.message); loadData(); }
    setSaving(false);
  }

  function openShiftModal(staffName, dateStr) {
    const existing = shifts[staffName]?.[dateStr];
    setShiftEdit({ staffName, dateStr, start: existing?.start ?? 8, end: existing?.end ?? 16, exists: !!existing });
    setShowShiftModal(true);
  }

  async function saveShift() {
    if (!shiftEdit) return;
    setSaving(true);
    setShifts(prev => ({ ...prev, [shiftEdit.staffName]: { ...prev[shiftEdit.staffName], [shiftEdit.dateStr]: { start: shiftEdit.start, end: shiftEdit.end } } }));
    setShowShiftModal(false);
    const { error } = await supabase.from("shifts").upsert({ staff_name: shiftEdit.staffName, shift_date: shiftEdit.dateStr, start_hour: shiftEdit.start, end_hour: shiftEdit.end }, { onConflict: "staff_name,shift_date" });
    if (error) { setError(error.message); loadData(); }
    setSaving(false);
  }

  async function deleteShift() {
    if (!shiftEdit) return;
    setSaving(true);
    setShifts(prev => { const copy = { ...prev, [shiftEdit.staffName]: { ...prev[shiftEdit.staffName] } }; delete copy[shiftEdit.staffName][shiftEdit.dateStr]; return copy; });
    setShowShiftModal(false);
    const { error } = await supabase.from("shifts").delete().eq("staff_name", shiftEdit.staffName).eq("shift_date", shiftEdit.dateStr);
    if (error) { setError(error.message); loadData(); }
    setSaving(false);
  }

  const filtered = tasks.filter(t => {
    if (filterStaff !== "All" && t.assignee !== filterStaff) return false;
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    return true;
  });
  const colCounts = STATUS_ORDER.reduce((a,s) => { a[s]=filtered.filter(t=>t.status===s).length; return a; }, {});
  const weekDates = getWeekDates(weekAnchor);
  function weekLabel() { const s=weekDates[0],e=weekDates[6]; const fmt=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`; }
  function shiftWeek(n) { setWeekAnchor(prev => { const d=new Date(prev); d.setDate(d.getDate()+n*7); return d; }); }
  function weekHours(staffName) { return weekDates.reduce((sum,date) => { const sh=shifts[staffName]?.[toDateStr(date)]; return sum+(sh?sh.end-sh.start:0); }, 0); }
  function dayTasksFor(staffName, dateStr) { return tasks.filter(t=>t.assignee===staffName&&t.scheduledDate===dateStr); }
  function dailyHeadcount(dateStr) { return STAFF.filter(s=>shifts[s.name]?.[dateStr]).length; }

  function TaskCard({ task, compact=false }) {
    const color = staffColor(task.assignee);
    return compact ? (
      <div className={`sched-chip status-${task.status}`}>
        <div className="sched-top"><span className="sched-ico">{task.icon}</span><span className="sched-ttl">{task.title}</span><span className="sched-dot" style={{background:PRIORITY_COLORS[task.priority]}}/></div>
        <div className="sched-meta"><span className="sched-room">📍 {task.room}</span><span className="sched-who" style={{background:color}}>{staffInitials(task.assignee)}</span></div>
        <div className="sched-actions">
          {task.status==="pending"&&<><button className="sched-btn start" onClick={()=>moveTask(task.id,"in-progress")}>▶ Start</button><button className="sched-btn delete" onClick={()=>deleteTask(task.id)}>✕</button></>}
          {task.status==="in-progress"&&<><button className="sched-btn complete" onClick={()=>moveTask(task.id,"done")}>✔ Done</button><button className="sched-btn undo" onClick={()=>moveTask(task.id,"pending")}>↩</button></>}
          {task.status==="done"&&<><button className="sched-btn undo" onClick={()=>moveTask(task.id,"in-progress")}>↩ Reopen</button><button className="sched-btn delete" onClick={()=>deleteTask(task.id)}>✕</button></>}
        </div>
      </div>
    ) : (
      <div className="task-card">
        <div className="task-top"><span className="task-icon">{task.icon}</span><span className="task-title">{task.title}</span><span className="priority-dot" style={{background:PRIORITY_COLORS[task.priority]}}/></div>
        <div className="task-room">📍 {task.room}</div>
        {task.notes&&<div className="task-room" style={{fontStyle:"italic",marginBottom:4}}>"{task.notes}"</div>}
        <div className="task-meta"><span className="task-assignee" style={{background:color}}>{task.assignee}</span><span className="task-time">{task.status==="done"?"Done "+timeAgo(task.completedAt):task.status==="in-progress"?"Started "+timeAgo(task.startedAt):"Added "+timeAgo(task.createdAt)}</span></div>
        <div className="task-actions">
          {task.status==="pending"&&<><button className="task-btn start" onClick={()=>moveTask(task.id,"in-progress")}>▶ Start</button><button className="task-btn delete" onClick={()=>deleteTask(task.id)}>✕</button></>}
          {task.status==="in-progress"&&<><button className="task-btn complete" onClick={()=>moveTask(task.id,"done")}>✔ Complete</button><button className="task-btn undo" onClick={()=>moveTask(task.id,"pending")}>↩ Undo</button></>}
          {task.status==="done"&&<><button className="task-btn undo" onClick={()=>moveTask(task.id,"in-progress")}>↩ Reopen</button><button className="task-btn delete" onClick={()=>deleteTask(task.id)}>✕ Remove</button></>}
        </div>
      </div>
    );
  }

  if (loading) return (<><style>{styles}</style><div className="loading-bar">Loading Housekeeping...</div></>);

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <div className="header-left">
            <h1>Housekeeping</h1>
            <p><span className="sync-dot"/>Live sync · {today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
          </div>
          <button className="add-btn" onClick={()=>openTaskModal()} disabled={saving}>+ Assign Task</button>
        </div>
        {error&&<div className="error-banner">⚠️ {error} — <button onClick={loadData} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontWeight:600,textDecoration:"underline"}}>Retry</button></div>}
        <div className="tabs">
          <button className={`tab ${tab==="overview"?"active":""}`} onClick={()=>setTab("overview")}>👥 Staff Overview</button>
          <button className={`tab ${tab==="board"?"active":""}`} onClick={()=>setTab("board")}>📋 Task Board</button>
          <button className={`tab ${tab==="schedule"?"active":""}`} onClick={()=>setTab("schedule")}>📅 Weekly Schedule</button>
        </div>
        <div className="stats-bar">
          <div className="stat"><div className="stat-num">{tasks.filter(t=>t.status==="pending").length}</div><div className="stat-label">Pending</div></div>
          <div className="stat"><div className="stat-num">{tasks.filter(t=>t.status==="in-progress").length}</div><div className="stat-label">In Progress</div></div>
          <div className="stat"><div className="stat-num">{tasks.filter(t=>t.status==="done").length}</div><div className="stat-label">Completed</div></div>
          <div className="stat"><div className="stat-num">{tasks.length}</div><div className="stat-label">Total Tasks</div></div>
        </div>

        {tab==="overview"&&(
          <>
            <div className="week-nav">
              <button className="week-nav-btn" onClick={()=>shiftWeek(-1)}>← Prev Week</button>
              <button className="week-nav-btn today-btn" onClick={()=>setWeekAnchor(new Date())}>This Week</button>
              <button className="week-nav-btn" onClick={()=>shiftWeek(1)}>Next Week →</button>
              <span className="week-range">{weekLabel()}</span>
            </div>
            <div className="ov-legend">
              <span style={{fontSize:"0.8rem",color:"var(--muted)",fontWeight:600}}>Legend:</span>
              <div className="ov-legend-item"><div className="ov-legend-swatch" style={{background:"var(--pending)"}}></div>Pending</div>
              <div className="ov-legend-item"><div className="ov-legend-swatch" style={{background:"var(--in-progress)"}}></div>In Progress</div>
              <div className="ov-legend-item"><div className="ov-legend-swatch" style={{background:"var(--done)"}}></div>Completed</div>
              <div className="ov-legend-item"><div className="ov-legend-swatch" style={{background:"repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 6px)"}}></div>Day off</div>
            </div>
            <div className="overview-wrap">
              <div className="ov-grid" style={{background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:14,overflow:"hidden"}}>
                <div className="ov-header-row">
                  <div className="ov-header-corner">Staff · {weekDates.filter(d=>dailyHeadcount(toDateStr(d))>0).length} active days</div>
                  {weekDates.map(date=>{const ds=toDateStr(date),isTday=ds===todayStr;return(<div key={ds} className={`ov-day-head${isTday?" is-today":""}`}><div className="ov-day-wday">{date.toLocaleDateString("en-US",{weekday:"short"})}</div><div className="ov-day-date">{date.getDate()}</div><div className="ov-day-sub">{dailyHeadcount(ds)} on shift</div></div>);})}
                </div>
                {STAFF.map(s=>(
                  <div key={s.name} className="ov-staff-row">
                    <div className="ov-staff-cell">
                      <div className="ov-avatar" style={{background:s.color}}>{s.initials}</div>
                      <div><div className="ov-staff-name">{s.name}</div><div className="ov-staff-role">{s.role}</div><div style={{fontSize:"0.68rem",color:s.color,fontWeight:600,marginTop:2}}>{weekHours(s.name)}h this week</div></div>
                    </div>
                    {weekDates.map(date=>{
                      const ds=toDateStr(date),isTday=ds===todayStr,shift=shifts[s.name]?.[ds],dtasks=dayTasksFor(s.name,ds);
                      return(<div key={ds} className={`ov-day-cell${isTday?" is-today":""}${!shift?" off":""}`} onClick={()=>openShiftModal(s.name,ds)}>
                        {shift?(<><div className="ov-shift-bar" style={{background:s.color}}><span className="ov-shift-time">{fmtHour(shift.start)}–{fmtHour(shift.end)}</span><span className="ov-shift-hrs">{shift.end-shift.start}h</span></div>
                        {dtasks.length>0&&<div className="ov-task-pills">{dtasks.slice(0,3).map(t=><div key={t.id} className={`ov-task-pill status-${t.status}`}>{t.icon} {t.title.split(" ")[0]}</div>)}{dtasks.length>3&&<div className="ov-task-pill status-pending">+{dtasks.length-3}</div>}</div>}
                        <button className="ov-add-shift" style={{marginTop:"auto"}} onClick={e=>{e.stopPropagation();openTaskModal(ds,s.name);}}>+ task</button></>):(<div className="ov-off-badge">Off</div>)}
                      </div>);
                    })}
                  </div>
                ))}
                <div className="ov-totals-row">
                  <div className="ov-total-label">Daily totals</div>
                  {weekDates.map(date=>{const ds=toDateStr(date),total=tasks.filter(t=>t.scheduledDate===ds).length,done=tasks.filter(t=>t.scheduledDate===ds&&t.status==="done").length;return(<div key={ds} className="ov-total-cell"><div className="ov-total-num">{total}</div><div className="ov-total-sub">{done} done</div></div>);})}
                </div>
              </div>
            </div>
          </>
        )}

        {tab==="board"&&(
          <>
            <div className="filters">
              <span className="filter-label">Staff:</span>
              {["All",...STAFF_NAMES].map(s=><button key={s} className={`filter-btn ${filterStaff===s?"active":""}`} onClick={()=>setFilterStaff(s)}>{s}</button>)}
              <span className="filter-label" style={{marginLeft:8}}>Priority:</span>
              {["All",...PRIORITIES].map(p=><button key={p} className={`filter-btn ${filterPriority===p?"active":""}`} onClick={()=>setFilterPriority(p)}>{p}</button>)}
            </div>
            <div className="board">
              {STATUS_ORDER.map(status=>(
                <div key={status} className="column">
                  <div className={`column-header ${status}`}><div className="col-title">{STATUS_ICONS[status]} {STATUS_LABELS[status]}</div><span className="col-count">{colCounts[status]}</span></div>
                  <div className="tasks">
                    {filtered.filter(t=>t.status===status).length===0&&<div className="empty">No tasks</div>}
                    {filtered.filter(t=>t.status===status).map(task=><TaskCard key={task.id} task={task}/>)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab==="schedule"&&(
          <>
            <div className="week-nav">
              <button className="week-nav-btn" onClick={()=>shiftWeek(-1)}>← Prev Week</button>
              <button className="week-nav-btn today-btn" onClick={()=>setWeekAnchor(new Date())}>Today</button>
              <button className="week-nav-btn" onClick={()=>shiftWeek(1)}>Next Week →</button>
              <span className="week-range">{weekLabel()}</span>
            </div>
            <div className="filters">
              <span className="filter-label">Filter by staff:</span>
              {["All",...STAFF_NAMES].map(s=><button key={s} className={`filter-btn ${filterStaff===s?"active":""}`} onClick={()=>setFilterStaff(s)}>{s}</button>)}
            </div>
            <div className="week-grid">
              {weekDates.map(date=>{
                const ds=toDateStr(date),isTday=ds===todayStr;
                const dayTasks=tasks.filter(t=>t.scheduledDate===ds&&(filterStaff==="All"||t.assignee===filterStaff));
                return(<div key={ds} className={`day-col${isTday?" is-today":""}`}>
                  <div className="day-header"><div className="day-name">{date.toLocaleDateString("en-US",{weekday:"short"})}</div><div className="day-num">{date.getDate()}</div><div className="day-month">{date.toLocaleDateString("en-US",{month:"short"})}</div><div className="day-task-count">{dayTasks.length===0?"No tasks":`${dayTasks.length} task${dayTasks.length>1?"s":""}`}</div></div>
                  <div className="day-tasks">
                    {dayTasks.length===0&&<div className="day-empty-msg">—</div>}
                    {dayTasks.map(task=><TaskCard key={task.id} task={task} compact={true}/>)}
                    <button className="add-day-btn" onClick={()=>openTaskModal(ds)}>+ Add task</button>
                  </div>
                </div>);
              })}
            </div>
          </>
        )}
      </div>

      {showTaskModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowTaskModal(false)}>
          <div className="modal">
            <div className="modal-header"><h2>Assign New Task</h2></div>
            <div className="modal-body">
              <div className="form-group"><label>Quick Select</label>
                <div className="template-grid">{TASK_TEMPLATES.map(t=><button key={t.label} className={`template-chip ${form.selectedTemplate===t.label?"selected":""}`} onClick={()=>selectTemplate(t)}><span>{t.icon}</span>{t.label}</button>)}</div>
              </div>
              <div className="form-group"><label>Task Name</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Room Cleaning"/></div>
              <div className="two-col">
                <div className="form-group"><label>Room / Location</label><input value={form.room} onChange={e=>setForm(f=>({...f,room:e.target.value}))} placeholder="e.g. Room 101"/></div>
                <div className="form-group"><label>Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={e=>setForm(f=>({...f,scheduledDate:e.target.value}))}/></div>
              </div>
              <div className="two-col">
                <div className="form-group"><label>Assign To</label><select value={form.assignee} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))}><option value="">— Select staff —</option>{STAFF_NAMES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
              </div>
              <div className="form-group"><label>Notes (optional)</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any special instructions..."/></div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={()=>setShowTaskModal(false)}>Cancel</button>
              <button className="save-btn" onClick={saveTask} disabled={!form.title||!form.room||!form.assignee||saving}>{saving?"Saving…":"Assign Task"}</button>
            </div>
          </div>
        </div>
      )}

      {showShiftModal&&shiftEdit&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowShiftModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{shiftEdit.exists?"Edit Shift":"Add Shift"}</h2>
              <p><span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:10,height:10,borderRadius:"50%",background:staffColor(shiftEdit.staffName),display:"inline-block"}}/>{shiftEdit.staffName}</span>{" · "}{new Date(shiftEdit.dateStr+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
            </div>
            <div className="modal-body">
              <div className="two-col">
                <div className="form-group"><label>Shift Start</label><select value={shiftEdit.start} onChange={e=>setShiftEdit(s=>({...s,start:+e.target.value}))}>{HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select></div>
                <div className="form-group"><label>Shift End</label><select value={shiftEdit.end} onChange={e=>setShiftEdit(s=>({...s,end:+e.target.value}))}>{HOURS.filter(h=>h>shiftEdit.start).map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select></div>
              </div>
              <div style={{background:"var(--accent-light)",borderRadius:8,padding:"10px 14px",fontSize:"0.82rem",color:"var(--accent)"}}>
                Shift length: <strong>{shiftEdit.end-shiftEdit.start} hours</strong> ({fmtHour(shiftEdit.start)} – {fmtHour(shiftEdit.end)})
              </div>
            </div>
            <div className="modal-footer">
              {shiftEdit.exists&&<button className="danger-btn" onClick={deleteShift}>Remove Shift</button>}
              <button className="cancel-btn" onClick={()=>setShowShiftModal(false)}>Cancel</button>
              <button className="save-btn" onClick={saveShift} disabled={shiftEdit.end<=shiftEdit.start||saving}>{saving?"Saving…":"Save Shift"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

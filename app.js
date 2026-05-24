import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configKey = "pairplan_config_v1";
const state = {
  supabase: null,
  user: null,
  pair: null,
  member: null,
  events: [],
  todos: [],
  wishes: [],
  plans: [],
  activities: [],
  channel: null
};

const els = {
  setupGate: q("#setupGate"),
  authGate: q("#authGate"),
  pairGate: q("#pairGate"),
  workspace: q("#workspace"),
  viewTitle: q("#viewTitle"),
  spaceLabel: q("#spaceLabel"),
  quickAdd: q("#quickAdd"),
  configForm: q("#configForm"),
  supabaseUrl: q("#supabaseUrl"),
  supabaseKey: q("#supabaseKey"),
  loginForm: q("#loginForm"),
  email: q("#email"),
  createPairForm: q("#createPairForm"),
  pairName: q("#pairName"),
  creatorNickname: q("#creatorNickname"),
  joinPairForm: q("#joinPairForm"),
  inviteCode: q("#inviteCode"),
  joinNickname: q("#joinNickname"),
  countdownText: q("#countdownText"),
  meetingMeta: q("#meetingMeta"),
  todoCount: q("#todoCount"),
  wishCount: q("#wishCount"),
  dateCount: q("#dateCount"),
  activityList: q("#activityList"),
  weekEvents: q("#weekEvents"),
  eventForm: q("#eventForm"),
  eventTitle: q("#eventTitle"),
  eventDate: q("#eventDate"),
  eventTime: q("#eventTime"),
  eventLocation: q("#eventLocation"),
  eventType: q("#eventType"),
  eventNote: q("#eventNote"),
  eventList: q("#eventList"),
  todoForm: q("#todoForm"),
  todoTitle: q("#todoTitle"),
  todoCategory: q("#todoCategory"),
  todoPriority: q("#todoPriority"),
  todoList: q("#todoList"),
  wishForm: q("#wishForm"),
  wishTitle: q("#wishTitle"),
  wishCategory: q("#wishCategory"),
  wishCost: q("#wishCost"),
  wishPriority: q("#wishPriority"),
  wishList: q("#wishList"),
  datePlanForm: q("#datePlanForm"),
  planTitle: q("#planTitle"),
  planDate: q("#planDate"),
  planBudget: q("#planBudget"),
  planLocation: q("#planLocation"),
  planSteps: q("#planSteps"),
  planNote: q("#planNote"),
  planList: q("#planList"),
  meetingForm: q("#meetingForm"),
  meetingAt: q("#meetingAt"),
  meetingPlace: q("#meetingPlace"),
  inviteDisplay: q("#inviteDisplay"),
  memberInfo: q("#memberInfo"),
  signOut: q("#signOut")
};

init();

async function init() {
  registerServiceWorker();
  bindEvents();
  const config = loadConfig();
  if (!config) return showGate("setup");
  els.supabaseUrl.value = config.url;
  els.supabaseKey.value = config.key;
  state.supabase = createClient(config.url, config.key);
  const { data } = await state.supabase.auth.getUser();
  state.user = data.user;
  if (!state.user) return showGate("auth");
  await loadPair();
}

function bindEvents() {
  qa(".tab").forEach((button) => on(button, "click", () => switchView(button.dataset.view)));
  on(els.quickAdd, "click", () => quickAdd());
  on(els.configForm, "submit", (event) => {
    event.preventDefault();
    localStorage.setItem(configKey, JSON.stringify({ url: els.supabaseUrl.value.trim(), key: els.supabaseKey.value.trim() }));
    location.reload();
  });
  on(els.loginForm, "submit", async (event) => {
    event.preventDefault();
    const email = els.email.value.trim();
    if (!email) return;
    const { error } = await state.supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    alert(error ? error.message : "登录链接已发送，请检查邮箱。");
  });
  on(els.createPairForm, "submit", createPair);
  on(els.joinPairForm, "submit", joinPair);
  on(els.eventForm, "submit", addEvent);
  on(els.todoForm, "submit", addTodo);
  on(els.wishForm, "submit", addWish);
  on(els.datePlanForm, "submit", addPlan);
  on(els.meetingForm, "submit", saveMeeting);
  on(els.signOut, "click", async () => {
    await state.supabase.auth.signOut();
    location.reload();
  });
  document.addEventListener("click", handleActions);
}

async function loadPair() {
  const { data: member, error } = await state.supabase
    .from("pair_members")
    .select("*, pairs(*)")
    .eq("user_id", state.user.id)
    .maybeSingle();
  if (error) return alert(error.message);
  if (!member) return showGate("pair");
  state.member = member;
  state.pair = member.pairs;
  await loadAll();
  subscribeRealtime();
  showGate("workspace");
  render();
}

async function createPair(event) {
  event.preventDefault();
  const invite = makeInviteCode();
  const { data: pair, error } = await state.supabase
    .from("pairs")
    .insert({ name: els.pairName.value.trim() || "我们的计划", invite_code: invite, created_by: state.user.id })
    .select()
    .single();
  if (error) return alert(error.message);
  const { error: memberError } = await state.supabase.from("pair_members").insert({
    pair_id: pair.id,
    user_id: state.user.id,
    nickname: els.creatorNickname.value.trim() || "我"
  });
  if (memberError) return alert(memberError.message);
  await logActivity(pair.id, "created_pair", "pair", pair.id, "创建了共享空间");
  await loadPair();
}

async function joinPair(event) {
  event.preventDefault();
  const code = els.inviteCode.value.trim().toUpperCase();
  const { data, error } = await state.supabase.rpc("join_pair_by_invite", {
    invite: code,
    nickname_input: els.joinNickname.value.trim() || "我"
  });
  if (error || !data) return alert(error?.message || "邀请码无效。");
  await logActivity(data, "joined_pair", "pair", data, "加入了共享空间");
  await loadPair();
}

async function loadAll() {
  const pairId = state.pair.id;
  const [events, todos, wishes, plans, activities] = await Promise.all([
    state.supabase.from("events").select("*").eq("pair_id", pairId).order("date", { ascending: true }),
    state.supabase.from("shared_items").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }),
    state.supabase.from("wishlist").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }),
    state.supabase.from("date_plans").select("*, plan_steps(*)").eq("pair_id", pairId).order("date", { ascending: true }),
    state.supabase.from("activity_log").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }).limit(20)
  ]);
  state.events = events.data || [];
  state.todos = todos.data || [];
  state.wishes = wishes.data || [];
  state.plans = plans.data || [];
  state.activities = activities.data || [];
}

function subscribeRealtime() {
  if (state.channel) state.supabase.removeChannel(state.channel);
  const pairId = state.pair.id;
  state.channel = state.supabase
    .channel(`pair-${pairId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "shared_items", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "wishlist", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plans", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .subscribe();
}

async function reloadAndRender() {
  await loadAll();
  render();
}

async function addEvent(event) {
  event.preventDefault();
  const row = {
    pair_id: state.pair.id,
    title: els.eventTitle.value.trim(),
    date: els.eventDate.value,
    time: els.eventTime.value || null,
    location: els.eventLocation.value.trim(),
    type: els.eventType.value,
    note: els.eventNote.value.trim(),
    created_by: state.user.id
  };
  if (!row.title || !row.date) return;
  const { data, error } = await state.supabase.from("events").insert(row).select().single();
  if (error) return alert(error.message);
  els.eventForm.reset();
  await logActivity(state.pair.id, "created_event", "event", data.id, `添加了日历：${row.title}`);
  await reloadAndRender();
}

async function addTodo(event) {
  event.preventDefault();
  const row = { pair_id: state.pair.id, title: els.todoTitle.value.trim(), category: els.todoCategory.value.trim(), priority: els.todoPriority.value, status: "open", created_by: state.user.id };
  if (!row.title) return;
  const { data, error } = await state.supabase.from("shared_items").insert(row).select().single();
  if (error) return alert(error.message);
  els.todoForm.reset();
  await logActivity(state.pair.id, "created_todo", "todo", data.id, `添加了一起做：${row.title}`);
  await reloadAndRender();
}

async function addWish(event) {
  event.preventDefault();
  const row = { pair_id: state.pair.id, title: els.wishTitle.value.trim(), category: els.wishCategory.value, estimated_cost: toNumber(els.wishCost.value), priority: els.wishPriority.value, status: "open", created_by: state.user.id };
  if (!row.title) return;
  const { data, error } = await state.supabase.from("wishlist").insert(row).select().single();
  if (error) return alert(error.message);
  els.wishForm.reset();
  await logActivity(state.pair.id, "created_wish", "wish", data.id, `添加了愿望：${row.title}`);
  await reloadAndRender();
}

async function addPlan(event) {
  event.preventDefault();
  const row = { pair_id: state.pair.id, title: els.planTitle.value.trim(), date: els.planDate.value || null, location: els.planLocation.value.trim(), budget: toNumber(els.planBudget.value), note: els.planNote.value.trim(), status: "planning", created_by: state.user.id };
  if (!row.title) return;
  const { data, error } = await state.supabase.from("date_plans").insert(row).select().single();
  if (error) return alert(error.message);
  const steps = els.planSteps.value.split("\n").map((step) => step.trim()).filter(Boolean);
  if (steps.length) {
    await state.supabase.from("plan_steps").insert(steps.map((title, index) => ({ plan_id: data.id, title, sort_order: index })));
  }
  els.datePlanForm.reset();
  await logActivity(state.pair.id, "created_plan", "plan", data.id, `创建了约会计划：${row.title}`);
  await reloadAndRender();
}

async function saveMeeting(event) {
  event.preventDefault();
  const { error } = await state.supabase.from("pairs").update({ next_meeting_at: els.meetingAt.value || null, next_meeting_place: els.meetingPlace.value.trim() }).eq("id", state.pair.id);
  if (error) return alert(error.message);
  state.pair.next_meeting_at = els.meetingAt.value || null;
  state.pair.next_meeting_place = els.meetingPlace.value.trim();
  await logActivity(state.pair.id, "updated_meeting", "pair", state.pair.id, "更新了下一次见面");
  render();
}

async function handleActions(event) {
  const toggleTodo = event.target.closest("[data-toggle-todo]");
  const toggleWish = event.target.closest("[data-toggle-wish]");
  const deleteEvent = event.target.closest("[data-delete-event]");
  if (toggleTodo) {
    const item = state.todos.find((todo) => todo.id === toggleTodo.dataset.toggleTodo);
    const done = item.status !== "done";
    await state.supabase.from("shared_items").update({ status: done ? "done" : "open", completed_by: done ? state.user.id : null, completed_at: done ? new Date().toISOString() : null }).eq("id", item.id);
    await logActivity(state.pair.id, "updated_todo", "todo", item.id, `${done ? "完成" : "恢复"}了一起做：${item.title}`);
  }
  if (toggleWish) {
    const item = state.wishes.find((wish) => wish.id === toggleWish.dataset.toggleWish);
    const done = item.status !== "done";
    await state.supabase.from("wishlist").update({ status: done ? "done" : "open" }).eq("id", item.id);
    await logActivity(state.pair.id, "updated_wish", "wish", item.id, `${done ? "实现" : "恢复"}了愿望：${item.title}`);
  }
  if (deleteEvent) {
    await state.supabase.from("events").delete().eq("id", deleteEvent.dataset.deleteEvent);
  }
  if (toggleTodo || toggleWish || deleteEvent) await reloadAndRender();
}

function render() {
  if (!state.pair) return;
  els.spaceLabel.textContent = state.pair.name;
  els.inviteDisplay.textContent = state.pair.invite_code;
  els.memberInfo.textContent = `${state.member.nickname} · ${state.user.email}`;
  els.meetingAt.value = state.pair.next_meeting_at ? state.pair.next_meeting_at.slice(0, 16) : "";
  els.meetingPlace.value = state.pair.next_meeting_place || "";
  renderHome();
  renderEvents();
  renderTodos();
  renderWishes();
  renderPlans();
}

function renderHome() {
  const openTodos = state.todos.filter((item) => item.status !== "done");
  const openWishes = state.wishes.filter((item) => item.status !== "done");
  const openPlans = state.plans.filter((item) => item.status !== "done");
  els.todoCount.textContent = openTodos.length;
  els.wishCount.textContent = openWishes.length;
  els.dateCount.textContent = openPlans.length;
  renderCountdown();
  els.activityList.innerHTML = state.activities.length ? state.activities.map((item) => `<article class="item-card"><div class="item-title">${escapeHtml(item.text)}</div><div class="item-meta"><span class="pill">${formatDateTime(item.created_at)}</span></div></article>`).join("") : empty("还没有更新。");
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const events = state.events.filter((event) => new Date(event.date) <= weekEnd).slice(0, 6);
  els.weekEvents.innerHTML = events.length ? events.map(renderEventCard).join("") : empty("本周没有共同日历。");
}

function renderCountdown() {
  if (!state.pair.next_meeting_at) {
    els.countdownText.textContent = "未设置";
    els.meetingMeta.textContent = "在设置里添加日期和地点。";
    return;
  }
  const diff = new Date(state.pair.next_meeting_at) - new Date();
  if (diff <= 0) {
    els.countdownText.textContent = "就是今天";
  } else {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    els.countdownText.textContent = `${days} 天 ${hours} 小时`;
  }
  els.meetingMeta.textContent = `${formatDateTime(state.pair.next_meeting_at)} · ${state.pair.next_meeting_place || "未设置地点"}`;
}

function renderEvents() {
  els.eventList.innerHTML = state.events.length ? state.events.map(renderEventCard).join("") : empty("还没有日历事件。");
}

function renderEventCard(event) {
  return `<article class="item-card"><div class="item-meta"><span class="pill">${escapeHtml(event.type)}</span><span class="pill">${escapeHtml(event.date)} ${event.time || ""}</span></div><div class="item-title">${escapeHtml(event.title)}</div><p class="quiet">${escapeHtml(event.location || "")}${event.note ? " · " + escapeHtml(event.note) : ""}</p><div class="item-actions"><button data-delete-event="${event.id}" type="button">删除</button></div></article>`;
}

function renderTodos() {
  els.todoList.innerHTML = state.todos.length ? state.todos.map((item) => `<article class="item-card ${item.status === "done" ? "done" : ""}"><div class="item-meta"><span class="pill">${escapeHtml(item.category || "未分类")}</span><span class="pill">${priorityLabel(item.priority)}</span></div><div class="item-title">${escapeHtml(item.title)}</div><div class="item-actions"><button data-toggle-todo="${item.id}" type="button">${item.status === "done" ? "恢复" : "完成"}</button></div></article>`).join("") : empty("还没有一起做的事。");
}

function renderWishes() {
  els.wishList.innerHTML = state.wishes.length ? state.wishes.map((item) => `<article class="item-card ${item.status === "done" ? "done" : ""}"><div class="item-meta"><span class="pill">${escapeHtml(item.category)}</span><span class="pill">${priorityLabel(item.priority)}</span>${item.estimated_cost ? `<span class="pill">预算 ${item.estimated_cost}</span>` : ""}</div><div class="item-title">${escapeHtml(item.title)}</div><div class="item-actions"><button data-toggle-wish="${item.id}" type="button">${item.status === "done" ? "恢复" : "已实现"}</button></div></article>`).join("") : empty("还没有愿望。");
}

function renderPlans() {
  els.planList.innerHTML = state.plans.length ? state.plans.map((plan) => `<article class="item-card"><div class="item-meta"><span class="pill">${plan.date || "未定日期"}</span>${plan.budget ? `<span class="pill">预算 ${plan.budget}</span>` : ""}</div><div class="item-title">${escapeHtml(plan.title)}</div><p class="quiet">${escapeHtml(plan.location || "")}${plan.note ? " · " + escapeHtml(plan.note) : ""}</p>${renderSteps(plan.plan_steps || [])}</article>`).join("") : empty("还没有约会计划。");
}

function renderSteps(steps) {
  if (!steps.length) return "";
  return `<div class="list">${steps.sort((a, b) => a.sort_order - b.sort_order).map((step) => `<span class="pill">${escapeHtml(step.title)}</span>`).join("")}</div>`;
}

async function logActivity(pairId, action, entityType, entityId, text) {
  await state.supabase.from("activity_log").insert({ pair_id: pairId, actor_id: state.user.id, action, entity_type: entityType, entity_id: entityId, text });
}

function showGate(name) {
  [els.setupGate, els.authGate, els.pairGate].forEach((node) => node.classList.remove("active"));
  els.workspace.classList.remove("active");
  if (name === "setup") els.setupGate.classList.add("active");
  if (name === "auth") els.authGate.classList.add("active");
  if (name === "pair") els.pairGate.classList.add("active");
  if (name === "workspace") els.workspace.classList.add("active");
}

function switchView(view) {
  const titles = { home: "首页", calendar: "日历", together: "一起做", wishlist: "愿望", dates: "约会", settings: "设置" };
  els.viewTitle.textContent = titles[view];
  qa(".tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  qa(".view").forEach((node) => node.classList.remove("active"));
  q(`#${view}View`)?.classList.add("active");
}

function quickAdd() {
  const active = q(".tab.active")?.dataset.view || "calendar";
  if (active === "home") switchView("calendar");
  else q(`#${active}View form input`)?.focus();
}

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem("pairplan_config_v1"));
  } catch {
    return null;
  }
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function priorityLabel(value) {
  return { high: "高优先级", medium: "中优先级", low: "低优先级" }[value] || "中优先级";
}

function toNumber(value) {
  return Number(String(value || "").replace(",", ".").replace(/[^\d.-]/g, "")) || null;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function q(selector) {
  return document.querySelector(selector);
}

function qa(selector) {
  return [...document.querySelectorAll(selector)];
}

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

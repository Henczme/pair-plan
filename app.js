import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configKey = "pairplan_config_v1";
const defaultConfig = {
  url: "https://wjozttzjtkpvclfcswev.supabase.co",
  key: "sb_publishable_69E3qjsbgGUq0119_Km4yA_t-phZznJ"
};
const timezoneKey = "pairplan_meeting_timezone_v1";
const meetingTimezones = {
  "Europe/Berlin": "德国柏林",
  "Asia/Shanghai": "中国北京时间"
};
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
  channel: null,
  syncTimer: null,
  notificationTimers: [],
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
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
  password: q("#password"),
  registerAccount: q("#registerAccount"),
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
  homeCalendar: q("#homeCalendar"),
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
  meetingTimezone: q("#meetingTimezone"),
  meetingPreview: q("#meetingPreview"),
  meetingPlace: q("#meetingPlace"),
  importantDayForm: q("#importantDayForm"),
  importantTitle: q("#importantTitle"),
  importantDate: q("#importantDate"),
  importantTime: q("#importantTime"),
  importantRepeat: q("#importantRepeat"),
  importantCountup: q("#importantCountup"),
  importantCountdown: q("#importantCountdown"),
  importantNote: q("#importantNote"),
  inviteDisplay: q("#inviteDisplay"),
  memberInfo: q("#memberInfo"),
  enableNotifications: q("#enableNotifications"),
  notificationStatus: q("#notificationStatus"),
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
    const password = els.password.value;
    if (!email || !password) return;
    const { error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    location.reload();
  });
  on(els.registerAccount, "click", async () => {
    const email = els.email.value.trim();
    const password = els.password.value;
    if (!email || !password) return alert("请输入邮箱和至少 6 位密码。");
    const { error } = await state.supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    alert("注册成功，正在进入。");
    location.reload();
  });
  on(els.createPairForm, "submit", createPair);
  on(els.joinPairForm, "submit", joinPair);
  on(els.eventForm, "submit", addEvent);
  on(els.todoForm, "submit", addTodo);
  on(els.wishForm, "submit", addWish);
  on(els.datePlanForm, "submit", addPlan);
  on(els.meetingForm, "submit", saveMeeting);
  on(els.importantDayForm, "submit", addImportantDay);
  on(els.meetingAt, "input", renderMeetingPreview);
  on(els.meetingTimezone, "change", () => {
    localStorage.setItem(timezoneKey, els.meetingTimezone.value);
    renderMeetingPreview();
  });
  on(els.enableNotifications, "click", enableNotifications);
  on(els.signOut, "click", async () => {
    await state.supabase.auth.signOut();
    location.reload();
  });
  document.addEventListener("click", handleActions);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.pair) reloadEverythingAndRender();
  });
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
  startAutoSync();
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
    state.supabase.from("shared_items").select("*").eq("pair_id", pairId).eq("status", "open").order("created_at", { ascending: false }),
    state.supabase.from("wishlist").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }),
    state.supabase.from("date_plans").select("*, plan_steps(*)").eq("pair_id", pairId).order("date", { ascending: true }),
    state.supabase.from("activity_log").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }).limit(5)
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
    .on("postgres_changes", { event: "*", schema: "public", table: "pairs", filter: `id=eq.${pairId}` }, reloadPairAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "shared_items", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "wishlist", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "date_plans", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "plan_steps" }, reloadAndRender)
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `pair_id=eq.${pairId}` }, reloadAndRender)
    .subscribe();
}

function startAutoSync() {
  clearInterval(state.syncTimer);
  state.syncTimer = setInterval(() => {
    if (!document.hidden && state.pair) reloadEverythingAndRender();
  }, 20000);
}

async function reloadPairAndRender() {
  const { data, error } = await state.supabase.from("pairs").select("*").eq("id", state.pair.id).single();
  if (!error && data) state.pair = data;
  render();
}

async function reloadAndRender() {
  await loadAll();
  render();
}

async function reloadEverythingAndRender() {
  await reloadPairAndRender();
  await loadAll();
  render();
}

async function addEvent(event) {
  event.preventDefault();
  const repeatsYearly = els.eventType.value === "纪念日";
  const row = {
    pair_id: state.pair.id,
    title: els.eventTitle.value.trim(),
    date: els.eventDate.value,
    time: els.eventTime.value || null,
    location: els.eventLocation.value.trim(),
    type: els.eventType.value,
    note: els.eventNote.value.trim(),
    repeats_yearly: repeatsYearly,
    show_countup: repeatsYearly,
    show_countdown: true,
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
  const timezone = els.meetingTimezone.value || "Europe/Berlin";
  const meetingIso = els.meetingAt.value ? zonedDateTimeToUtcIso(els.meetingAt.value, timezone) : null;
  const { error } = await state.supabase.from("pairs").update({ next_meeting_at: meetingIso, next_meeting_place: els.meetingPlace.value.trim() }).eq("id", state.pair.id);
  if (error) return alert(error.message);
  state.pair.next_meeting_at = meetingIso;
  state.pair.next_meeting_place = els.meetingPlace.value.trim();
  await logActivity(state.pair.id, "updated_meeting", "pair", state.pair.id, "更新了下一次见面");
  await reloadPairAndRender();
  render();
}

async function addImportantDay(event) {
  event.preventDefault();
  const title = els.importantTitle.value.trim();
  const date = els.importantDate.value;
  if (!title || !date) return;
  const type = els.importantRepeat.checked ? "纪念日" : "重要日";
  const { data, error } = await state.supabase.from("events").insert({
    pair_id: state.pair.id,
    title,
    date,
    time: els.importantTime.value || null,
    location: "",
    type,
    note: els.importantNote.value.trim(),
    repeats_yearly: els.importantRepeat.checked,
    show_countup: els.importantCountup.checked,
    show_countdown: els.importantCountdown.checked,
    created_by: state.user.id
  }).select().single();
  if (error) return alert(error.message);
  els.importantDayForm.reset();
  await logActivity(state.pair.id, "created_important_day", "event", data.id, `添加了${type}：${title}`);
  await reloadAndRender();
}

async function handleActions(event) {
  const toggleTodo = event.target.closest("[data-toggle-todo]");
  const toggleWish = event.target.closest("[data-toggle-wish]");
  const deleteEvent = event.target.closest("[data-delete-event]");
  const calendarMove = event.target.closest("[data-calendar-move]");
  if (calendarMove) {
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() + Number(calendarMove.dataset.calendarMove));
    renderHomeCalendar();
    return;
  }
  if (toggleTodo) {
    const item = state.todos.find((todo) => todo.id === toggleTodo.dataset.toggleTodo);
    if (!item) return;
    await logActivity(state.pair.id, "completed_todo", "todo", item.id, `完成了一起做：${item.title}`);
    await state.supabase.from("shared_items").delete().eq("id", item.id);
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
  els.meetingTimezone.value = localStorage.getItem(timezoneKey) || guessMeetingTimezone();
  els.meetingAt.value = state.pair.next_meeting_at ? formatForDateTimeInput(state.pair.next_meeting_at, els.meetingTimezone.value) : "";
  els.meetingPlace.value = state.pair.next_meeting_place || "";
  renderMeetingPreview();
  renderHome();
  renderEvents();
  renderTodos();
  renderWishes();
  renderPlans();
  scheduleNotifications();
}

function renderHome() {
  const openTodos = state.todos.filter((item) => item.status !== "done");
  const openWishes = state.wishes.filter((item) => item.status !== "done");
  const openPlans = state.plans.filter((item) => item.status !== "done");
  els.todoCount.textContent = openTodos.length;
  els.wishCount.textContent = openWishes.length;
  els.dateCount.textContent = openPlans.length;
  renderCountdown();
  renderHomeCalendar();
  els.activityList.innerHTML = state.activities.length ? state.activities.map((item) => `<article class="item-card"><div class="item-title">${escapeHtml(item.text)}</div><div class="item-meta"><span class="pill">${formatDateTime(item.created_at)}</span></div></article>`).join("") : empty("还没有更新。");
  const entries = getCalendarEntries().filter((entry) => entry.date >= startOfToday()).slice(0, 1);
  els.weekEvents.innerHTML = entries.length ? entries.map(renderCalendarEntryCard).join("") : empty("还没有近期安排。");
}

function renderHomeCalendar() {
  const now = new Date();
  const monthStart = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  const firstCell = new Date(monthStart);
  firstCell.setDate(1 - ((monthStart.getDay() + 6) % 7));
  const entries = getCalendarEntries();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    const key = toDateKey(date);
    const dayEntries = entries.filter((entry) => {
      const calendarDate = entry.startedDate || entry.date;
      return toDateKey(entry.date) === key || (entry.repeatsYearly && calendarDate.getMonth() === date.getMonth() && calendarDate.getDate() === date.getDate());
    });
    const classes = ["calendar-day", date.getMonth() === monthStart.getMonth() ? "" : "muted-day", toDateKey(date) === toDateKey(now) ? "today" : "", dayEntries.length ? "has-items" : ""].filter(Boolean).join(" ");
    return `<div class="${classes}"><span>${date.getDate()}</span>${dayEntries.slice(0, 3).map((entry) => `<i class="${entry.owner} ${entry.kind}" title="${escapeHtml(entry.title)}"></i>`).join("")}</div>`;
  }).join("");
  els.homeCalendar.innerHTML = `<div class="calendar-head"><button data-calendar-move="-1" type="button">‹</button><strong>${monthStart.getFullYear()}年 ${monthStart.getMonth() + 1}月</strong><button data-calendar-move="1" type="button">›</button></div><p class="quiet">每年重复的重要日会自动出现在对应月份。</p><div class="calendar-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="calendar-grid">${cells}</div><div class="calendar-legend"><span><i class="mine"></i>我添加</span><span><i class="partner"></i>对方添加</span><span><i class="meeting"></i>见面</span><span><i class="anniversary"></i>每年重复</span></div>`;
}

function renderCountdown() {
  if (!state.pair.next_meeting_at) {
    els.countdownText.textContent = "未设置";
    els.meetingMeta.textContent = "在设置里添加日期和地点。";
    return;
  }
  const meetingDate = new Date(state.pair.next_meeting_at);
  const diff = meetingDate - new Date();
  if (diff <= 0) {
    els.countdownText.textContent = "就是今天";
  } else {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    els.countdownText.textContent = `${days} 天 ${hours} 小时`;
  }
  els.meetingMeta.innerHTML = `${renderMeetingTimes(meetingDate)}${state.pair.next_meeting_place ? `<span class="place-line">地点：${escapeHtml(state.pair.next_meeting_place)}</span>` : `<span class="place-line">地点：未设置</span>`}`;
}

function renderEvents() {
  els.eventList.innerHTML = state.events.length ? state.events.map(renderEventCard).join("") : empty("还没有日历事件。");
}

function renderEventCard(event) {
  const entry = calendarEntryFromEvent(event);
  return `<article class="item-card"><div class="item-meta"><span class="pill">${escapeHtml(event.type || "日历")}</span><span class="pill">${escapeHtml(event.date)} ${event.time || ""}</span>${renderDateMetricPills(entry)}</div><div class="item-title">${escapeHtml(event.title)}</div><p class="quiet">${escapeHtml(event.location || "")}${event.note ? " · " + escapeHtml(event.note) : ""}</p><div class="item-actions"><button data-delete-event="${event.id}" type="button">删除</button></div></article>`;
}

function renderCalendarEntryCard(entry) {
  return `<article class="item-card"><div class="item-meta"><span class="pill">${escapeHtml(entry.label)}</span><span class="pill">${formatDateOnly(entry.date)} ${entry.time || ""}</span><span class="pill">${entry.ownerLabel}</span>${renderDateMetricPills(entry)}</div><div class="item-title">${escapeHtml(entry.title)}</div><p class="quiet">${escapeHtml(entry.meta || "")}</p></article>`;
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
  await pruneActivities(pairId);
}

async function pruneActivities(pairId) {
  const { data } = await state.supabase.from("activity_log").select("id").eq("pair_id", pairId).order("created_at", { ascending: false }).range(5, 1000);
  if (data?.length) await state.supabase.from("activity_log").delete().in("id", data.map((item) => item.id));
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
    return JSON.parse(localStorage.getItem(configKey)) || defaultConfig;
  } catch {
    return defaultConfig;
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

function renderMeetingPreview() {
  if (!els.meetingPreview) return;
  if (!els.meetingAt.value) {
    els.meetingPreview.textContent = "保存后会同时显示柏林和北京时间。";
    return;
  }
  const timezone = els.meetingTimezone.value || "Europe/Berlin";
  const date = new Date(zonedDateTimeToUtcIso(els.meetingAt.value, timezone));
  els.meetingPreview.innerHTML = `${meetingTimezones[timezone]}输入：${escapeHtml(els.meetingAt.value.replace("T", " "))}<br>${renderMeetingTimes(date)}`;
}

function renderMeetingTimes(date) {
  return `<span class="time-stack"><span>德国柏林时间 ${formatInTimezone(date, "Europe/Berlin")}</span><span>中国北京时间 ${formatInTimezone(date, "Asia/Shanghai")}</span></span>`;
}

function getCalendarEntries() {
  const entries = state.events.map(calendarEntryFromEvent);
  state.plans.forEach((plan) => {
    if (!plan.date) return;
    entries.push({
      id: `plan-${plan.id}`,
      title: plan.title,
      date: parseDateOnly(plan.date),
      startedDate: parseDateOnly(plan.date),
      time: "",
      label: "约会计划",
      kind: "plan",
      owner: plan.created_by === state.user.id ? "mine" : "partner",
      ownerLabel: plan.created_by === state.user.id ? "我添加" : "对方添加",
      repeatsYearly: false,
      showCountup: false,
      showCountdown: false,
      meta: plan.location || "",
      notifyAt: null
    });
  });
  if (state.pair?.next_meeting_at) {
    entries.push({
      id: `meeting-${state.pair.id}`,
      title: "下一次见面",
      date: new Date(state.pair.next_meeting_at),
      startedDate: new Date(state.pair.next_meeting_at),
      time: formatTimeOnly(state.pair.next_meeting_at),
      label: "见面",
      kind: "meeting",
      owner: "meeting",
      ownerLabel: "见面提醒",
      repeatsYearly: false,
      showCountup: false,
      showCountdown: false,
      meta: state.pair.next_meeting_place || "",
      notifyAt: state.pair.next_meeting_at
    });
  }
  return entries.sort((a, b) => a.date - b.date);
}

function calendarEntryFromEvent(event) {
  const repeatsYearly = isRepeatingEvent(event);
  const date = getDisplayDateForEvent(event);
  const startedDate = parseDateOnly(event.date);
  return {
    id: `event-${event.id}`,
    title: event.title,
    date,
    startedDate,
    time: event.time || "",
    label: repeatsYearly ? "每年重复" : event.type || "日历",
    kind: repeatsYearly ? "anniversary" : "event",
    owner: event.created_by === state.user.id ? "mine" : "partner",
    ownerLabel: event.created_by === state.user.id ? "我添加" : "对方添加",
    repeatsYearly,
    showCountup: event.show_countup ?? repeatsYearly,
    showCountdown: event.show_countdown !== false,
    meta: [event.location, event.note].filter(Boolean).join(" · "),
    notifyAt: event.time ? zonedDateTimeToUtcIso(`${toDateKey(date)}T${event.time.slice(0, 5)}`, els.meetingTimezone?.value || guessMeetingTimezone()) : null
  };
}

function getDisplayDateForEvent(event) {
  const date = parseDateOnly(event.date);
  if (!isRepeatingEvent(event)) return date;
  const now = new Date();
  const currentYearDate = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  return currentYearDate < startOfToday() ? new Date(now.getFullYear() + 1, date.getMonth(), date.getDate()) : currentYearDate;
}

function isRepeatingEvent(event) {
  return Boolean(event.repeats_yearly) || event.type === "纪念日";
}

function renderDateMetricPills(entry) {
  const metrics = getDateMetrics(entry);
  const pills = [];
  if (entry.showCountup && metrics.countupText) pills.push(`<span class="pill metric-pill">${metrics.countupText}</span>`);
  if (entry.showCountdown && metrics.countdownText) pills.push(`<span class="pill metric-pill">${metrics.countdownText}</span>`);
  return pills.join("");
}

function getDateMetrics(entry) {
  const today = startOfToday();
  const started = startOfDate(entry.startedDate || entry.date);
  const target = startOfDate(entry.date);
  const passedDays = Math.floor((today - started) / 86400000);
  const daysUntil = Math.ceil((target - today) / 86400000);
  const countupText = passedDays >= 0 ? `已经 ${passedDays} 天` : `还有 ${Math.abs(passedDays)} 天开始`;
  let countdownText = "";
  if (daysUntil > 0) countdownText = `下次还有 ${daysUntil} 天`;
  else if (daysUntil === 0) countdownText = entry.repeatsYearly ? "下次就是今天" : "就是今天";
  else countdownText = `已过 ${Math.abs(daysUntil)} 天`;
  return { countupText, countdownText };
}

function scheduleNotifications() {
  state.notificationTimers.forEach(clearTimeout);
  state.notificationTimers = [];
  updateNotificationStatus();
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  getCalendarEntries().filter((entry) => entry.notifyAt).forEach((entry) => {
    const when = new Date(entry.notifyAt).getTime();
    [
      { offset: 3600000, prefix: "1小时后" },
      { offset: 0, prefix: "现在" }
    ].forEach((reminder) => {
      const delay = when - reminder.offset - now;
      if (delay > 0 && delay < 7 * 86400000) {
        state.notificationTimers.push(setTimeout(() => showNotification(`${reminder.prefix}：${entry.title}`, entry.meta || "PairPlan 提醒"), delay));
      }
    });
  });
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("这个浏览器不支持通知。");
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission === "granted") {
    showNotification("PairPlan 提醒已开启", "App 打开或安装到桌面后会尽量准时提醒。");
    scheduleNotifications();
  }
}

function showNotification(title, body) {
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, { body, icon: "icon.svg", badge: "icon.svg" })).catch(() => new Notification(title, { body }));
  } else {
    new Notification(title, { body });
  }
}

function updateNotificationStatus() {
  if (!els.notificationStatus) return;
  if (!("Notification" in window)) {
    els.notificationStatus.textContent = "当前浏览器不支持通知。";
  } else if (Notification.permission === "granted") {
    els.notificationStatus.textContent = "提醒已开启。后台长期推送受 iOS 和浏览器限制，打开或桌面安装时最可靠。";
  } else if (Notification.permission === "denied") {
    els.notificationStatus.textContent = "通知被系统拒绝，需要在浏览器或系统设置里重新允许。";
  } else {
    els.notificationStatus.textContent = "开启后会在见面和带时间的日历事件前提醒。";
  }
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfDate(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(value);
}

function formatTimeOnly(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function guessMeetingTimezone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone === "Asia/Shanghai" ? "Asia/Shanghai" : "Europe/Berlin";
}

function formatInTimezone(value, timeZone) {
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(value).find((part) => part.type === "timeZoneName")?.value || "";
  return `${dateText}${offset ? ` (${offset})` : ""}`;
}

function formatForDateTimeInput(value, timeZone) {
  const parts = getZonedParts(new Date(value), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function zonedDateTimeToUtcIso(value, timeZone) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const desiredUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  let utcMs = desiredUtcMs;
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const actualUtcMs = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    utcMs += desiredUtcMs - actualUtcMs;
  }
  return new Date(utcMs).toISOString();
}

function getZonedParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(value).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  if (parts.hour === "24") parts.hour = "00";
  return parts;
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

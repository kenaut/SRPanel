/* ===== SRPanel Dashboard 前端逻辑（中英双语） ===== */
(function () {
  "use strict";

  var API_URL = "api/stats";
  var LANG_KEY = "srpanel-lang";

  var state = {
    timer: null,
    intervalMs: 2000,
    paused: false,
    lang: "zh",
    lastData: null,
    connected: null, // null=连接中 / true=在线 / false=失败
  };

  /* ---------- 文案 ---------- */

  var I18N = {
    zh: {
      docTitle: "SRPanel · 服务器资源监控",
      loading: "加载中…",
      connecting: "连接中…",
      online: "实时连接",
      offline: "连接失败",
      refreshInterval: "刷新间隔",
      pause: "暂停",
      resume: "继续",
      cpuUsage: "CPU 使用率",
      memory: "内存",
      diskRoot: "磁盘（根分区）",
      uptime: "系统运行时间",
      bootTimeInit: "启动时间 --",
      bootedAt: "启动时间 {time}",
      cpuCores: "CPU 各核心",
      logicalCores: "{n} 逻辑核心",
      coreN: "核心 #{i}",
      cpuMeta: "{phys} 核 / {log} 线程",
      memMeta: "已用 {used} / 共 {total} · 可用 {avail}",
      loadAvg: "系统负载（1/5/15 分钟）：{a} / {b} / {c}",
      loadAvgNa: "系统负载：不可用",
      network: "网络流量",
      liveRate: "实时速率",
      uploadRate: "发送速率",
      downloadRate: "接收速率",
      netTotalInit: "累计 ↑ -- / ↓ --",
      netTotal: "累计 ↑ {sent} / ↓ {recv}",
      diskPartitions: "磁盘分区",
      allMounts: "全部挂载点",
      noDisks: "未检测到磁盘分区",
      diskRootMeta: "{mount} · 已用 {used} / {total} · 剩余 {free}",
      systemInfo: "系统信息",
      systemSub: "系统",
      hostName: "主机名",
      osLabel: "操作系统",
      kernelLabel: "内核版本",
      archLabel: "架构",
      pythonLabel: "Python",
      swapLabel: "Swap",
      notAvailable: "不可用",
      footerTagline: "SRPanel · 开源服务器资源监控面板",
      lastUpdated: "最近更新：",
      uptimeD: "{d} 天",
      uptimeH: "{h} 小时",
      uptimeM: "{m} 分钟",
    },
    en: {
      docTitle: "SRPanel · Server Monitor",
      loading: "Loading…",
      connecting: "Connecting…",
      online: "Live",
      offline: "Disconnected",
      refreshInterval: "Refresh",
      pause: "Pause",
      resume: "Resume",
      cpuUsage: "CPU Usage",
      memory: "Memory",
      diskRoot: "Disk (Root)",
      uptime: "Uptime",
      bootTimeInit: "Booted --",
      bootedAt: "Booted {time}",
      cpuCores: "CPU Cores",
      logicalCores: "{n} logical cores",
      coreN: "Core #{i}",
      cpuMeta: "{phys} cores / {log} threads",
      memMeta: "Used {used} / {total} total · {avail} available",
      loadAvg: "Load average (1/5/15 min): {a} / {b} / {c}",
      loadAvgNa: "Load average: N/A",
      network: "Network",
      liveRate: "Real-time",
      uploadRate: "Upload",
      downloadRate: "Download",
      netTotalInit: "Total ↑ -- / ↓ --",
      netTotal: "Total ↑ {sent} / ↓ {recv}",
      diskPartitions: "Disk Partitions",
      allMounts: "All mounts",
      noDisks: "No disk partitions detected",
      diskRootMeta: "{mount} · Used {used} / {total} · {free} free",
      systemInfo: "System Info",
      systemSub: "System",
      hostName: "Hostname",
      osLabel: "OS",
      kernelLabel: "Kernel",
      archLabel: "Architecture",
      pythonLabel: "Python",
      swapLabel: "Swap",
      notAvailable: "N/A",
      footerTagline: "SRPanel · Open Source Server Monitor",
      lastUpdated: "Updated: ",
      uptimeD: "{d}d",
      uptimeH: "{h}h",
      uptimeM: "{m}m",
    },
  };

  function t(key, vars) {
    var str = (I18N[state.lang] && I18N[state.lang][key]) || key;
    if (vars) {
      str = str.replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] !== undefined ? vars[k] : "";
      });
    }
    return str;
  }

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- 语言切换 ---------- */

  function initLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* 忽略隐私模式 */ }
    if (saved === "zh" || saved === "en") {
      state.lang = saved;
    } else {
      var nav = (navigator.language || "zh").toLowerCase();
      state.lang = nav.indexOf("zh") === 0 ? "zh" : "en";
    }
  }

  function applyI18n() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.title = t("docTitle");

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }

    // 语言按钮显示“切换后的目标语言”
    $("lang-btn").textContent = state.lang === "zh" ? "EN" : "中";
    updatePauseLabel();

    // 恢复连接状态文案（避免被静态 connecting 覆盖）
    var statusText = state.connected === null
      ? t("connecting")
      : state.connected ? t("online") : t("offline");
    $("status-text").textContent = statusText;

    // 用新语言重绘已有数据（动态文案）
    if (state.lastData) render(state.lastData);
  }

  /* ---------- 格式化工具 ---------- */

  function formatBytes(bytes, decimals) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "--";
    if (bytes === 0) return "0 B";
    decimals = decimals === undefined ? 1 : decimals;
    var units = ["B", "KB", "MB", "GB", "TB", "PB"];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    i = Math.min(i, units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : decimals) + " " + units[i];
  }

  function formatRate(bytesPerSec) {
    return formatBytes(bytesPerSec) + "/s";
  }

  function formatUptime(seconds) {
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var parts = [];
    if (d > 0) parts.push(t("uptimeD", { d: d }));
    if (h > 0 || d > 0) parts.push(t("uptimeH", { h: h }));
    parts.push(t("uptimeM", { m: m }));
    return parts.join(" ");
  }

  function levelClass(percent) {
    if (percent >= 90) return "danger";
    if (percent >= 70) return "warn";
    return "";
  }

  function setBar(fillEl, percent) {
    fillEl.style.width = Math.min(100, Math.max(0, percent)) + "%";
    fillEl.className = "progress-fill " + levelClass(percent);
  }

  /* ---------- 状态指示 ---------- */

  function setStatus(ok) {
    state.connected = ok;
    var dot = $("status-dot");
    var text = $("status-text");
    dot.className = "status-dot " + (ok ? "online" : "offline");
    text.textContent = ok ? t("online") : t("offline");
  }

  /* ---------- 渲染 ---------- */

  function renderCpu(cpu) {
    $("cpu-percent").textContent = cpu.percent.toFixed(1);
    setBar($("cpu-bar"), cpu.percent);

    var meta = t("cpuMeta", { phys: cpu.count_physical, log: cpu.count_logical });
    if (cpu.frequency_mhz > 0) meta += " · " + (cpu.frequency_mhz / 1000).toFixed(2) + " GHz";
    $("cpu-meta").textContent = meta;

    // 每个逻辑核心
    var coresEl = $("cpu-cores");
    coresEl.innerHTML = cpu.per_cpu
      .map(function (p, i) {
        var cls = levelClass(p);
        return (
          '<div class="core">' +
          '<div class="core-name">' + t("coreN", { i: i }) + "</div>" +
          '<div class="core-value">' + p.toFixed(0) + "%</div>" +
          '<div class="progress"><div class="progress-fill ' + cls +
          '" style="width:' + Math.min(100, p) + '%"></div></div>' +
          "</div>"
        );
      })
      .join("");

    $("cpu-cores-sub").textContent = t("logicalCores", { n: cpu.count_logical });
    $("cpu-extra").textContent = cpu.load_avg
      ? t("loadAvg", { a: cpu.load_avg[0], b: cpu.load_avg[1], c: cpu.load_avg[2] })
      : t("loadAvgNa");
  }

  function renderMemory(mem, swap) {
    $("mem-percent").textContent = mem.percent.toFixed(1);
    setBar($("mem-bar"), mem.percent);
    $("mem-meta").textContent = t("memMeta", {
      used: formatBytes(mem.used),
      total: formatBytes(mem.total),
      avail: formatBytes(mem.available),
    });

    var swapText = t("notAvailable");
    if (swap.total > 0) {
      swapText = formatBytes(swap.used) + " / " + formatBytes(swap.total) +
        " (" + swap.percent.toFixed(1) + "%)";
    }
    $("sys-info").children[5].querySelector("b").textContent = swapText;
  }

  function renderDisks(disks) {
    var listEl = $("disk-list");
    if (!disks.length) {
      listEl.innerHTML = '<p class="meta">' + t("noDisks") + "</p>";
      return;
    }
    listEl.innerHTML = disks
      .map(function (d) {
        var cls = levelClass(d.percent);
        return (
          '<div class="disk-item">' +
          '<div class="disk-top">' +
          '<span class="disk-mount" title="' + d.device + " " + d.fstype + '">' +
            d.mountpoint + "</span>" +
          '<span class="disk-detail">' + formatBytes(d.used) + " / " +
            formatBytes(d.total) + " · " + d.percent.toFixed(1) + "%</span>" +
          "</div>" +
          '<div class="progress"><div class="progress-fill ' + cls +
          '" style="width:' + Math.min(100, d.percent) + '%"></div></div>' +
          "</div>"
        );
      })
      .join("");

    // 概览卡片取根分区（/），没有则用第一个
    var root = disks.filter(function (d) { return d.mountpoint === "/"; })[0] || disks[0];
    $("disk-percent").textContent = root.percent.toFixed(1);
    setBar($("disk-bar"), root.percent);
    $("disk-meta").textContent = t("diskRootMeta", {
      mount: root.mountpoint,
      used: formatBytes(root.used),
      total: formatBytes(root.total),
      free: formatBytes(root.free),
    });
  }

  function renderNetwork(net) {
    $("net-send-rate").textContent = formatRate(net.send_rate);
    $("net-recv-rate").textContent = formatRate(net.recv_rate);
    $("net-total").textContent = t("netTotal", {
      sent: formatBytes(net.bytes_sent),
      recv: formatBytes(net.bytes_recv),
    });
  }

  function renderSystem(sys) {
    $("hostname").textContent = sys.hostname;
    $("uptime").textContent = formatUptime(sys.uptime);
    $("boot-time").textContent = t("bootedAt", {
      time: new Date(sys.boot_time * 1000).toLocaleString(),
    });
    $("os-info").textContent = sys.os;

    var rows = $("sys-info").children;
    rows[0].querySelector("b").textContent = sys.hostname;
    rows[1].querySelector("b").textContent = sys.os;
    rows[2].querySelector("b").textContent = sys.kernel;
    rows[3].querySelector("b").textContent = sys.machine;
    rows[4].querySelector("b").textContent = sys.python;
  }

  function render(data) {
    renderSystem(data.system);
    renderCpu(data.cpu);
    renderMemory(data.memory, data.swap);
    renderDisks(data.disks);
    renderNetwork(data.network);
  }

  /* ---------- 轮询 ---------- */

  function poll() {
    fetch(API_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json.ok) throw new Error(json.error || "API error");
        state.lastData = json.data;
        render(json.data);
        setStatus(true);
      })
      .catch(function () {
        setStatus(false);
      })
      .then(function () {
        $("updated").textContent = new Date().toLocaleTimeString();
      });
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (!state.paused) {
      state.timer = setInterval(poll, state.intervalMs);
    }
  }

  function updatePauseLabel() {
    $("pause-btn").textContent = state.paused ? t("resume") : t("pause");
    $("pause-btn").classList.toggle("paused", state.paused);
  }

  /* ---------- 控件事件 ---------- */

  $("interval-select").addEventListener("change", function (e) {
    state.intervalMs = parseInt(e.target.value, 10);
    startTimer();
  });

  $("pause-btn").addEventListener("click", function () {
    state.paused = !state.paused;
    updatePauseLabel();
    startTimer();
  });

  $("lang-btn").addEventListener("click", function () {
    state.lang = state.lang === "zh" ? "en" : "zh";
    try { localStorage.setItem(LANG_KEY, state.lang); } catch (e) { /* 忽略 */ }
    applyI18n();
  });

  // 初始化语言 → 立即拉取一次 → 定时刷新
  initLang();
  applyI18n();
  poll();
  startTimer();
})();

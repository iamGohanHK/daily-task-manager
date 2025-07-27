// Task manager script
document.addEventListener('DOMContentLoaded', () => {
  // DOM references
  const csvInput = document.getElementById('csvInput');
  const sheetUrlInput = document.getElementById('sheetUrl');
  const loadSheetBtn = document.getElementById('loadSheet');
  const todoList = document.getElementById('todoList');
  const inProgressList = document.getElementById('inProgressList');
  const completedList = document.getElementById('completedList');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const rewardDisplay = document.getElementById('rewardPoints');
  // Rewards store elements
  const rewardListEl = document.getElementById('rewardList');

  // Day selector element for switching between different day schedules
  const daySelectorEl = document.getElementById('daySelector');

  // Catalog of rewards that users can claim. Each reward has a name and
  // an associated cost in points. Higher‑time activities such as movies
  // and calling friends cost more points to reflect the larger time
  // investment away from work. Feel free to adjust these values to suit
  // your personal preferences.
  const rewardCatalog = [
    { name: 'Browsing Twitter', cost: 2 },
    { name: 'YouTube Video', cost: 3 },
    { name: 'Nap', cost: 5 },
    { name: 'Calling Friends', cost: 6 },
    { name: 'Eating Outside (Favourite Dish)', cost: 8 },
    { name: 'Movie', cost: 10 }
  ];

  /**
   * Render the list of rewards available to claim. Each reward item
   * shows its name, cost in points, and includes a claim button. The
   * claim button is enabled only when the user has enough points.
   */
  function renderRewardStore() {
    if (!rewardListEl) return;
    rewardListEl.innerHTML = '';
    rewardCatalog.forEach((reward, idx) => {
      const item = document.createElement('div');
      item.classList.add('reward-item');
      // Title and cost
      const title = document.createElement('span');
      title.textContent = `${reward.name} (cost: ${reward.cost} pts)`;
      item.appendChild(title);
      // Claim button
      const btn = document.createElement('button');
      btn.textContent = 'Claim';
      btn.addEventListener('click', () => {
        claimReward(reward);
      });
      item.appendChild(btn);
      rewardListEl.appendChild(item);
    });
    // After creating elements, update their disabled state
    updateRewardButtons();
  }

  /**
   * Enable or disable claim buttons based on the user's current points.
   */
  function updateRewardButtons() {
    if (!rewardListEl) return;
    const currentPoints = getRewardPoints();
    const buttons = rewardListEl.querySelectorAll('button');
    buttons.forEach((btn, idx) => {
      const reward = rewardCatalog[idx];
      if (currentPoints >= reward.cost) {
        btn.disabled = false;
      } else {
        btn.disabled = true;
      }
    });
  }

  /**
   * Handle claiming a reward. If the user has enough points, subtract the
   * reward cost from their balance, update the display, and show a
   * congratulatory message. Otherwise, inform the user they need more points.
   *
   * @param {{name: string, cost: number}} reward
   */
  function claimReward(reward) {
    const currentPoints = getRewardPoints();
    if (currentPoints >= reward.cost) {
      // Deduct cost and update display
      setRewardPoints(currentPoints - reward.cost);
      alert(`You claimed "${reward.name}" and spent ${reward.cost} points! Enjoy your break.`);
    } else {
      alert('Not enough points to claim this reward. Keep completing pomodoros to earn more!');
    }
  }
  // Timer elements
  const timerDisplay = document.getElementById('timerDisplay');
  const startTimerBtn = document.getElementById('startTimer');
  const pauseTimerBtn = document.getElementById('pauseTimer');
  const resetTimerBtn = document.getElementById('resetTimer');
  const workDurationInput = document.getElementById('workDuration');
  const breakDurationInput = document.getElementById('breakDuration');

  // Fullscreen timer elements
  const toggleFullscreenBtn = document.getElementById('toggleFullscreen');
  const fullscreenOverlay = document.getElementById('fullscreenOverlay');
  const fullscreenClock = document.getElementById('fullscreenClock');
  const exitFullscreenBtn = document.getElementById('exitFullscreen');

  // Determine current date for default day logic
  const todayDate = new Date();
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const dd = String(todayDate.getDate()).padStart(2, '0');
  // Storage key for all tasks by day
  const tasksByDayKey = 'tasksByDay';

  // In‑memory task state
  // tasksByDay is an object mapping day keys (e.g., 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'today')
  // to arrays of task objects. Each task has id, time, desc and status.
  let tasksByDay = {};
  // tasks is a reference to the array for the currently selected day
  let tasks = [];
  // The currently selected day key. Determines which tasks array is active.
  let selectedDay = '';
  let selectedTaskId = null;
  let timerInterval = null;
  let timerSecondsRemaining = 0;
  let isWorkPeriod = true;

  // Reward points
  function getRewardPoints() {
    return parseInt(localStorage.getItem('rewardPoints') || '0', 10);
  }

  // Play a simple notification sound using the Web Audio API
  function playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const duration = 0.5;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch (err) {
      console.warn('Web Audio API unsupported', err);
    }
  }
  function setRewardPoints(points) {
    localStorage.setItem('rewardPoints', String(points));
    rewardDisplay.textContent = `${points} points`;
    // Update availability of reward claim buttons if present
    if (typeof updateRewardButtons === 'function') {
      // Defer to next tick in case reward list not yet rendered
      setTimeout(() => updateRewardButtons(), 0);
    }
  }

  // Initialise reward display
  setRewardPoints(getRewardPoints());

  /**
   * Load tasksByDay from localStorage. If stored data exists it is parsed
   * into an object mapping day keys to arrays of task objects. Otherwise
   * tasksByDay is initialized as an empty object. After loading, the
   * selectedDay is set to a default value (today or the first available
   * key) and tasks is updated to reference the corresponding array.
   */
  function loadTasks() {
    const stored = localStorage.getItem(tasksByDayKey);
    if (stored) {
      try {
        tasksByDay = JSON.parse(stored);
      } catch (err) {
        console.error('Failed to parse tasksByDay from storage', err);
        tasksByDay = {};
      }
    } else {
      tasksByDay = {};
    }
    setDefaultSelectedDay();
  }

  /**
   * Persist the tasksByDay object to localStorage. Should be called after
   * any mutation of tasksByDay to ensure changes persist across sessions.
   */
  function saveTasks() {
    localStorage.setItem(tasksByDayKey, JSON.stringify(tasksByDay));
  }

  /**
   * Set the initial selected day. Prefers 'today' if present in tasksByDay,
   * otherwise falls back to the current weekday abbreviation (e.g. 'mon'),
   * then to the first key in tasksByDay, and finally to an empty string.
   */
  function setDefaultSelectedDay() {
    // Determine current weekday abbreviation (sun, mon, tue, wed, thu, fri, sat)
    const weekdayNames = ['sun','mon','tue','wed','thu','fri','sat'];
    const currentDayAbbrev = weekdayNames[new Date().getDay()];
    if (tasksByDay.hasOwnProperty('today')) {
      selectedDay = 'today';
    } else if (tasksByDay.hasOwnProperty(currentDayAbbrev)) {
      selectedDay = currentDayAbbrev;
    } else {
      const keys = Object.keys(tasksByDay);
      selectedDay = keys.length > 0 ? keys[0] : '';
    }
    // Update reference to tasks array
    tasks = tasksByDay[selectedDay] || [];
  }

  /**
   * Switch to a different day. Updates the selectedDay, points tasks to
   * the appropriate array, re-renders the day selector and tasks, and
   * updates progress indicators.
   *
   * @param {string} dayKey The canonical key representing the day to select
   */
  function setSelectedDay(dayKey) {
    if (!dayKey || !tasksByDay.hasOwnProperty(dayKey)) return;
    selectedDay = dayKey;
    tasks = tasksByDay[selectedDay];
    selectedTaskId = null;
    renderDaySelector();
    renderTasks();
  }

  /**
   * Render the day selector buttons based on the current tasksByDay keys.
   * The button for the selectedDay will have the 'active' class. Each
   * button's click handler calls setSelectedDay() to switch contexts.
   */
  function renderDaySelector() {
    if (!daySelectorEl) return;
    daySelectorEl.innerHTML = '';
    const keys = Object.keys(tasksByDay);
    // Sort keys so 'today' appears first, then weekdays in order sun..sat
    const weekdayOrder = ['sun','mon','tue','wed','thu','fri','sat'];
    keys.sort((a, b) => {
      if (a === 'today') return -1;
      if (b === 'today') return 1;
      const ai = weekdayOrder.indexOf(a);
      const bi = weekdayOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    keys.forEach(key => {
      const btn = document.createElement('button');
      // Capitalize display: 'today' => 'Today', 'mon' => 'Mon'
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      btn.textContent = label;
      if (key === selectedDay) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        setSelectedDay(key);
      });
      daySelectorEl.appendChild(btn);
    });
    // If there are no days, show a message
    if (keys.length === 0) {
      const msg = document.createElement('span');
      msg.textContent = 'No schedule loaded yet';
      msg.style.fontStyle = 'italic';
      daySelectorEl.appendChild(msg);
    }
  }

  // Render tasks to the UI
  function renderTasks() {
    // Clear lists
    todoList.innerHTML = '';
    inProgressList.innerHTML = '';
    completedList.innerHTML = '';
    tasks.forEach(task => {
      const card = document.createElement('div');
      card.classList.add('task');
      card.dataset.id = task.id;
      card.dataset.status = task.status;
      card.innerHTML = `<span class="task-time">${task.time}</span><span class="task-desc">${task.desc}</span>`;
      // highlight selected task
      if (task.id === selectedTaskId) {
        card.style.outline = '2px solid #f5a623';
      }
      // Click event for selecting task for Pomodoro
      card.addEventListener('click', (e) => {
        // toggle selection
        if (selectedTaskId === task.id) {
          selectedTaskId = null;
        } else {
          selectedTaskId = task.id;
        }
        renderTasks();
      });
      // Append to appropriate list
      if (task.status === 'todo') {
        todoList.appendChild(card);
      } else if (task.status === 'inProgress') {
        inProgressList.appendChild(card);
      } else {
        completedList.appendChild(card);
      }
    });
    updateProgress();
  }

  // Update task status and persist
  function updateTaskStatus(taskId, status) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      // If completed, deselect
      if (status === 'completed' && selectedTaskId === taskId) {
        selectedTaskId = null;
      }
      saveTasks();
      renderTasks();
    }
  }

  // Update progress bar and text
  function updateProgress() {
    const total = tasks ? tasks.length : 0;
    const completed = tasks ? tasks.filter(t => t.status === 'completed').length : 0;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}% complete`;
  }

  // Generate a simple unique ID
  function generateId() {
    return 'task-' + Math.random().toString(36).substr(2, 9);
  }

  // Parse CSV data and create tasks for current day
  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;
    const rows = lines.map(line => {
      // naive CSV split; works for simple numeric cells; no quotes support
      return line.split(',').map(cell => cell.trim());
    });
    // Find the header row: look for row containing known day names in columns beyond the first
    const validNames = ['sun','mon','tue','wed','thu','fri','sat','today','tod','current','cur'];
    let headerRowIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.slice(1).map(c => c.toLowerCase().replace(/[^a-z]/g, ''));
      if (cells.some(c => validNames.includes(c))) {
        headerRowIndex = i;
        break;
      }
    }
    const header = rows[headerRowIndex];
    const dayHeaders = header.slice(1);
    // Helper to canonicalise a header value to a consistent key
    function canonicalDay(name) {
      const clean = name.toLowerCase().replace(/[^a-z]/g, '');
      if (['today','tod','current','cur'].includes(clean)) return 'today';
      // Map full names or abbreviations to three-letter weekday codes
      const map = {
        sunday: 'sun', sun: 'sun', monday: 'mon', mon: 'mon', tuesday: 'tue', tue: 'tue', wednesday: 'wed', wed: 'wed',
        thursday: 'thu', thu: 'thu', friday: 'fri', fri: 'fri', saturday: 'sat', sat: 'sat'
      };
      return map[clean] || clean;
    }
    // Reset tasksByDay
    tasksByDay = {};
    // Initialise arrays for each header column
    dayHeaders.forEach((h, idx) => {
      const key = canonicalDay(h);
      if (!tasksByDay[key]) tasksByDay[key] = [];
    });
    // Iterate through data rows after the header row
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const time = row[0] || '';
      for (let j = 0; j < dayHeaders.length; j++) {
        const cell = row[j + 1] || '';
        if (cell) {
          const key = canonicalDay(dayHeaders[j]);
          if (!tasksByDay[key]) tasksByDay[key] = [];
          tasksByDay[key].push({
            id: generateId(),
            time: time,
            desc: cell,
            status: 'todo'
          });
        }
      }
    }
    saveTasks();
    // Set selected day default and re-render
    setDefaultSelectedDay();
    renderDaySelector();
    renderTasks();
  }

  // Drag and drop using SortableJS
  function setupDragAndDrop() {
    // To Do column
    new Sortable(todoList, {
      group: 'tasks',
      animation: 150,
      onAdd: (evt) => {
        const taskId = evt.item.dataset.id;
        updateTaskStatus(taskId, 'todo');
      },
      onEnd: () => {
        // Save order if needed
      }
    });
    // In Progress column
    new Sortable(inProgressList, {
      group: 'tasks',
      animation: 150,
      onAdd: (evt) => {
        const taskId = evt.item.dataset.id;
        updateTaskStatus(taskId, 'inProgress');
      },
      onEnd: () => {}
    });
    // Completed column
    new Sortable(completedList, {
      group: 'tasks',
      animation: 150,
      onAdd: (evt) => {
        const taskId = evt.item.dataset.id;
        updateTaskStatus(taskId, 'completed');
      },
      onEnd: () => {}
    });
  }

  // CSV file upload handler
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      parseCsv(evt.target.result);
    };
    reader.readAsText(file);
  });

  // Show file picker when label clicked
  document.querySelector('.file-label').addEventListener('click', () => {
    csvInput.click();
  });

  // Load sheet via URL button
  loadSheetBtn.addEventListener('click', () => {
    const url = sheetUrlInput.value.trim();
    if (!url) return;
    const exportUrl = buildSheetExportUrl(url);
    if (!exportUrl) {
      alert('Invalid Google Sheets link.');
      return;
    }
    fetch(exportUrl)
      .then(resp => {
        if (!resp.ok) throw new Error('Network error');
        return resp.text();
      })
      .then(text => {
        parseCsv(text);
      })
      .catch(err => {
        console.error(err);
        alert('Failed to fetch the sheet. Make sure it is published or try downloading as CSV and uploading instead.');
      });
  });

  // Build Google Sheets export to CSV URL from various link patterns
  function buildSheetExportUrl(link) {
    try {
      const url = new URL(link);
      if (url.hostname !== 'docs.google.com') return null;
      // Extract spreadsheet ID
      const parts = url.pathname.split('/');
      const dIndex = parts.indexOf('d');
      const id = parts[dIndex + 1];
      if (!id) return null;
      // Extract gid parameter if available
      let gid = '0';
      if (url.hash) {
        const gidMatch = url.hash.match(/gid=(\d+)/);
        if (gidMatch) gid = gidMatch[1];
      }
      if (url.searchParams.has('gid')) {
        gid = url.searchParams.get('gid');
      }
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&id=${id}&gid=${gid}`;
    } catch (err) {
      return null;
    }
  }

  // Pomodoro timer functions
  function updateTimerDisplay() {
    const minutes = Math.floor(timerSecondsRemaining / 60).toString().padStart(2, '0');
    const seconds = (timerSecondsRemaining % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
    // Also update the full‑screen display
    if (fullscreenClock) {
      fullscreenClock.textContent = `${minutes}:${seconds}`;
    }
  }
  function startPomodoro() {
    // If timer already running, ignore
    if (timerInterval) return;
    // If no task selected and work period, require selection
    if (isWorkPeriod && !selectedTaskId) {
      alert('Please select a task to work on by clicking it.');
      return;
    }
    // Determine duration based on period type
    const workMins = parseInt(workDurationInput.value, 10) || 25;
    const breakMins = parseInt(breakDurationInput.value, 10) || 5;
    if (timerSecondsRemaining <= 0) {
      timerSecondsRemaining = (isWorkPeriod ? workMins : breakMins) * 60;
      updateTimerDisplay();
    }
    timerInterval = setInterval(() => {
      timerSecondsRemaining--;
      updateTimerDisplay();
      if (timerSecondsRemaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        handleTimerEnd();
      }
    }, 1000);
  }
  function pausePomodoro() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  function resetPomodoro() {
    pausePomodoro();
    timerSecondsRemaining = 0;
    isWorkPeriod = true;
    updateTimerDisplay();
  }
  function handleTimerEnd() {
    // When a work period ends: mark selected task complete and award points
    if (isWorkPeriod) {
      if (selectedTaskId) {
        // Mark the task as completed in our task list
        updateTaskStatus(selectedTaskId, 'completed');

        /*
         * Award reward points using a progressive algorithm.
         *
         * Instead of granting a flat number of points each time a pomodoro
         * finishes, we calculate a bonus based on how many tasks have been
         * completed so far today. This provides a sense of momentum: the
         * more sessions you finish, the larger the reward you earn for
         * subsequent sessions. For example, the first completed task earns 1
         * point, the second earns 2 points, the third earns 3 points, and
         * so on. The number of completed tasks is determined from the
         * current `tasks` array after updating the task status above.
         */
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const currentPoints = getRewardPoints();
        // add the completedCount as the bonus for this session
        setRewardPoints(currentPoints + completedCount);

        // Play completion sound and show notification
        playSound();
        alert('Great job! You completed a pomodoro and your task is marked as complete.');
      }
    }
    // Toggle between work and break periods
    isWorkPeriod = !isWorkPeriod;
    timerSecondsRemaining = 0;
    updateTimerDisplay();
  }
  // Attach timer button events
  startTimerBtn.addEventListener('click', startPomodoro);
  pauseTimerBtn.addEventListener('click', pausePomodoro);
  resetTimerBtn.addEventListener('click', resetPomodoro);

  // Fullscreen toggling
  if (toggleFullscreenBtn && fullscreenOverlay && exitFullscreenBtn) {
    toggleFullscreenBtn.addEventListener('click', () => {
      // Show overlay and update display
      fullscreenOverlay.classList.remove('hidden');
      updateTimerDisplay();
      // Attempt to enter browser full‑screen mode
      if (fullscreenOverlay.requestFullscreen) {
        fullscreenOverlay.requestFullscreen().catch(() => {});
      }
    });
    exitFullscreenBtn.addEventListener('click', () => {
      fullscreenOverlay.classList.add('hidden');
      // Exit browser full‑screen if active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Initialize: load persisted tasks, setup drag‑and‑drop and render UI
  loadTasks();
  setupDragAndDrop();
  // Render day selector and initial tasks list
  renderDaySelector();
  renderTasks();
  updateTimerDisplay();

  // Render the reward store on first load
  renderRewardStore();
});
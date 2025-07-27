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
  // Timer elements
  const timerDisplay = document.getElementById('timerDisplay');
  const startTimerBtn = document.getElementById('startTimer');
  const pauseTimerBtn = document.getElementById('pauseTimer');
  const resetTimerBtn = document.getElementById('resetTimer');
  const workDurationInput = document.getElementById('workDuration');
  const breakDurationInput = document.getElementById('breakDuration');

  // Determine key for today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const tasksKey = `tasks-${yyyy}-${mm}-${dd}`;

  // In‑memory task state
  let tasks = [];
  let selectedTaskId = null;
  let timerInterval = null;
  let timerSecondsRemaining = 0;
  let isWorkPeriod = true;

  // Reward points
  function getRewardPoints() {
    return parseInt(localStorage.getItem('rewardPoints') || '0', 10);
  }
  function setRewardPoints(points) {
    localStorage.setItem('rewardPoints', String(points));
    rewardDisplay.textContent = `${points} points`;
  }

  // Initialise reward display
  setRewardPoints(getRewardPoints());

  // Load tasks from localStorage
  function loadTasks() {
    const stored = localStorage.getItem(tasksKey);
    if (stored) {
      try {
        tasks = JSON.parse(stored);
      } catch (err) {
        console.error('Failed to parse tasks from storage', err);
        tasks = [];
      }
    } else {
      tasks = [];
    }
  }

  // Save tasks to localStorage
  function saveTasks() {
    localStorage.setItem(tasksKey, JSON.stringify(tasks));
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
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
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
    // Determine header row: first row
    const header = rows[0];
    const dayHeaders = header.slice(1).map(h => h.toLowerCase());
    /*
     * Determine the column for today.
     *
     * We first look for headers labelled "today" (or similar). This allows
     * spreadsheets to specify a generic "today" column instead of using
     * weekday abbreviations. If no "today" header is found we fall back
     * to matching the current weekday abbreviation (sun, mon, tue, etc.).
     */
    let dayIndex = dayHeaders.findIndex(h => {
      // normalise header text: remove whitespace and punctuation
      const clean = h.replace(/[^a-z]/g, '');
      return clean === 'today' || clean === 'tod' || clean === 'current' || clean === 'cur';
    });
    if (dayIndex === -1) {
      // Determine today's day abbreviation (e.g., mon, tue)
      const weekdayNames = ['sun','mon','tue','wed','thu','fri','sat'];
      const currentDay = weekdayNames[today.getDay()];
      // look for header starting with the current day abbreviation
      dayIndex = dayHeaders.findIndex(h => h.startsWith(currentDay));
    }
    // If still not found, alert the user
    if (dayIndex === -1) {
      alert('Could not find a column matching today in the uploaded sheet.');
      return;
    }
    // Clear existing tasks and create new ones
    tasks = [];
    // Iterate through rows (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const time = row[0] || '';
      const cell = row[dayIndex + 1] || '';
      if (cell) {
        const task = {
          id: generateId(),
          time: time,
          desc: cell,
          status: 'todo'
        };
        tasks.push(task);
      }
    }
    saveTasks();
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
    // When work period ends: mark selected task complete, award points
    if (isWorkPeriod) {
      // Mark selected task as completed
      if (selectedTaskId) {
        updateTaskStatus(selectedTaskId, 'completed');
        // Award points
        const currentPoints = getRewardPoints();
        setRewardPoints(currentPoints + 1);
        // Play audio or show notification? For now, alert
        alert('Great job! You completed a pomodoro and your task is marked as complete.');
      }
    }
    // Toggle period
    isWorkPeriod = !isWorkPeriod;
    timerSecondsRemaining = 0;
    updateTimerDisplay();
  }
  // Attach timer button events
  startTimerBtn.addEventListener('click', startPomodoro);
  pauseTimerBtn.addEventListener('click', pausePomodoro);
  resetTimerBtn.addEventListener('click', resetPomodoro);

  // Initialize
  loadTasks();
  setupDragAndDrop();
  renderTasks();
  updateTimerDisplay();
});
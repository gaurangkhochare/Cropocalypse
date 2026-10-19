(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('editorCanvas');
  const ctx = canvas.getContext('2d');
  const resultCtx = $('resultCanvas').getContext('2d');

  const chaosSettings = {
    mild: { adjustmentChance: 0.4, snapChance: 0.4 },
    medium: { adjustmentChance: 0.6, snapChance: 0.65 },
    max: { adjustmentChance: 0.8, snapChance: 0.85 }
  };

  const approvalStages = [
    { title: 'Review Crop', description: 'This is the moment when the committee pretends to admire your composition in silence.' },
    { title: 'Verify Dimensions', description: 'Double-check the crop is still a proper square and not merely confident.' },
    { title: 'Approve Composition', description: 'Consider whether the subject remains centered and emotionally stable.' },
    { title: 'Confirm Squareness', description: 'One last check for geometric honesty and existential drift.' },
    { title: 'Final Approval', description: 'The final stage creates the real 512 × 512 PNG and lets the image leave the lab.' }
  ];

  const baseButtonLabels = {
    centerBtn: 'Re-center image',
    resetBtn: 'Reset everything',
    reviewBtn: 'Review crop →',
    saveBtn: 'Approve & download',
    backBtn: 'Back to editing',
    approvalBack: 'Back',
    approvalNext: 'Continue',
    fixPixelsBtn: '🛠️ Fix Pixels',
    ignorePixelsBtn: '🙈 Ignore Pixels'
  };

  const misleadingLabels = {
    centerBtn: 'Center Destiny',
    resetBtn: 'Return to Yesterday',
    reviewBtn: 'Request Approval',
    saveBtn: 'Preserve Pixels',
    backBtn: 'Return to Reason',
    approvalBack: 'Back to The Beginning',
    approvalNext: 'Continue With Confidence',
    fixPixelsBtn: '🛠️ Repair the Drama',
    ignorePixelsBtn: '🙈 Allow Chaos'
  };

  const state = {
    image: null,
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    crop: { x: 0, y: 0, size: 0 },
    dragging: false,
    dragMode: 'pan',
    dragStart: { x: 0, y: 0 },
    lastPointer: { x: 0, y: 0 },
    resizeHandle: null,
    nudgeCount: 0,
    reviewCount: 0,
    chaosMode: 'mild',
    confusingLabels: false,
    pixelModalOpen: false,
    captchaOpen: false,
    assistantVisible: true,
    assistantMinimized: false,
    approvalStage: 0,
    achievementSet: new Set(),
    perfectionValue: 12,
    captchaDelayTimer: null,
    captchaCountdownTimer: null
  };
  const pixelModalInterval = 8000;
  let pixelModalTimer;

  const ui = {
    imageInput: $('imageInput'),
    fileName: $('fileName'),
    imageDimensions: $('imageDimensions'),
    zoomRange: $('zoomRange'),
    zoomValue: $('zoomValue'),
    rotateRange: $('rotateRange'),
    rotateValue: $('rotateValue'),
    centerBtn: $('centerBtn'),
    resetBtn: $('resetBtn'),
    reviewBtn: $('reviewBtn'),
    hintBtn: $('hintBtn'),
    hintText: $('hintText'),
    gridToggle: $('gridToggle'),
    mirrorToggle: $('mirrorToggle'),
    confuseToggle: $('confuseToggle'),
    statusPill: $('statusPill'),
    statusMessage: $('statusMessage'),
    noticeText: $('noticeText'),
    nudge: $('nudge'),
    ratioStatus: $('ratioStatus'),
    positionStatus: $('positionStatus'),
    meterFill: $('meterFill'),
    meterText: $('meterText'),
    backBtn: $('backBtn'),
    saveBtn: $('saveBtn'),
    approvalNote: $('approvalNote'),
    resultPanel: $('resultPanel'),
    captchaModal: $('captchaModal'),
    captchaCheckbox: $('captchaCheckbox'),
    captchaVerify: $('captchaVerify'),
    captchaCountdown: $('captchaCountdown'),
    captchaClose: $('captchaClose'),
    captchaCancel: $('captchaCancel'),
    pixelModal: $('pixelModal'),
    fixPixelsBtn: $('fixPixelsBtn'),
    ignorePixelsBtn: $('ignorePixelsBtn'),
    pixelClose: $('pixelClose'),
    chaosMode: $('chaosMode'),
    normalModeBtn: $('normalModeBtn'),
    approvalModal: $('approvalModal'),
    approvalStageTitle: $('approvalStageTitle'),
    approvalStageCopy: $('approvalStageCopy'),
    approvalProgressFill: $('approvalProgressFill'),
    approvalStepLabel: $('approvalStepLabel'),
    approvalBack: $('approvalBack'),
    approvalNext: $('approvalNext'),
    approvalClose: $('approvalClose'),
    assistantPanel: $('assistantPanel'),
    assistantBody: $('assistantBody'),
    assistantMinimize: $('assistantMinimize'),
    assistantClose: $('assistantClose'),
    footerHelp: $('footerHelp'),
    toastContainer: $('toastContainer'),
    pixelConfidence: $('pixelConfidence'),
    squareEnergy: $('squareEnergy'),
    cropStability: $('cropStability'),
    committeeApproval: $('committeeApproval'),
    perfectionDetected: $('perfectionDetected')
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function fitCrop() {
    const side = Math.min(canvas.width, canvas.height) * 0.72;
    state.crop.size = side;
    state.crop.x = (canvas.width - side) / 2;
    state.crop.y = (canvas.height - side) / 2;
  }

  function clampCrop() {
    const minGap = 18;
    const minSize = 160;
    const maxSize = Math.min(canvas.width, canvas.height) - minGap * 2;
    state.crop.size = clamp(state.crop.size, minSize, maxSize);
    state.crop.x = clamp(state.crop.x, minGap, canvas.width - state.crop.size - minGap);
    state.crop.y = clamp(state.crop.y, minGap, canvas.height - state.crop.size - minGap);
  }

  function setStatus(message, level = 'normal') {
    ui.statusMessage.textContent = message;
    if (level === 'success') {
      ui.statusPill.textContent = '✓ Crop completed';
      ui.statusPill.classList.add('success');
    } else if (state.image) {
      ui.statusPill.textContent = '● Crop in progress';
      ui.statusPill.classList.remove('success');
    } else {
      ui.statusPill.textContent = '● Awaiting upload';
      ui.statusPill.classList.remove('success');
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    ui.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  function setButtonLabel(key, label) {
    const node = $(key);
    if (node) node.textContent = label;
  }

  function applyConfusingLabels() {
    const labels = state.confusingLabels ? misleadingLabels : baseButtonLabels;
    Object.entries(labels).forEach(([key, value]) => setButtonLabel(key, value));
  }

  function triggerAchievement(name) {
    if (state.achievementSet.has(name)) return;
    state.achievementSet.add(name);
    showToast(`Achievement unlocked: ${name}`, 'success');
  }

  function updateDashboard() {
    const mood = state.image ? 'MAYBE' : 'N/A';
    const pixelValue = clamp(Math.round((state.zoom * 24) + state.nudgeCount * 5 + state.rotation * 0.4), 40, 98);
    const squareValue = state.image ? (state.crop.size > 300 ? 'HIGH' : 'QUESTIONABLE') : 'LOW';
    const stabilityValue = state.image ? (state.panX || state.panY ? 'QUESTIONABLE' : 'STABLE') : 'NO IMAGE';
    const committeeValue = `${Math.min(5, 1 + Math.floor(state.reviewCount / 2))}/5`;

    ui.pixelConfidence.textContent = `${pixelValue}%`;
    ui.squareEnergy.textContent = squareValue;
    ui.cropStability.textContent = stabilityValue;
    ui.committeeApproval.textContent = committeeValue;
    ui.perfectionDetected.textContent = mood;
  }

  function updateMeter() {
    if (!state.image) {
      state.perfectionValue = 12;
      ui.meterFill.style.width = '12%';
      ui.meterText.textContent = '12% — emotionally ready';
      return;
    }

    const drift = Math.round((state.zoom - 1) * 18 + state.nudgeCount * 5 + (state.rotation / 5) * 2);
    state.perfectionValue = clamp(18 + drift + (Math.random() * 12 - 6), 12, 94);

    const label = state.perfectionValue > 75 ? 'Suspiciously close' :
      state.perfectionValue > 45 ? 'Under reconsideration' :
      state.perfectionValue > 24 ? 'Almost Perfect' : 'Emotionally ready';

    ui.meterFill.style.width = `${state.perfectionValue}%`;
    ui.meterText.textContent = `${Math.round(state.perfectionValue)}% — ${label}`;
  }

  function syncZoomSlider() {
    const sliderValue = clamp(3.5 - state.zoom, 1, 2.5);
    ui.zoomRange.value = sliderValue.toFixed(2);
    ui.zoomValue.textContent = `${state.zoom.toFixed(2)}×`;
  }

  function maybeChaosAdjustment() {
    const config = chaosSettings[state.chaosMode];
    if (!config || Math.random() > config.adjustmentChance) return;

    const change = (Math.random() * 0.18) * (Math.random() > 0.5 ? 1 : -1);
    const nextZoom = clamp(state.zoom + change, 1, 2.5);
    if (Math.abs(nextZoom - state.zoom) > 0.01) {
      state.zoom = nextZoom;
      syncZoomSlider();
      showToast('Zoom department has made a recommendation.', 'warn');
      renderCanvas();
    }
  }

  function maybeTriggerPixelModal() {
    if (state.pixelModalOpen) return;
    openPixelModal();
  }

  function triggerAssistant(message) {
    if (!state.assistantVisible) return;
    const entry = document.createElement('div');
    entry.className = 'assistant-message';
    entry.innerHTML = `<strong>CropGPT:</strong> ${message}`;
    ui.assistantBody.appendChild(entry);
    ui.assistantBody.scrollTop = ui.assistantBody.scrollHeight;
  }

  function assistantMessageFor(kind) {
    const messages = {
      zoom: [
        'Your image contains a promising number of pixels.',
        'Have you considered making the square more square?',
        'The crop box is emotionally committed to being centered.'
      ],
      pan: [
        'Your image appears slightly off-center.',
        'Interesting. It now appears off-center in a different direction.',
        'It looks like the subject is preparing for a dramatic reveal.'
      ],
      rotate: [
        'I recommend reviewing your previous review.',
        'My analysis confirms that this is an image.',
        'A slightly different angle may help the square recover.'
      ]
    };

    const list = messages[kind] || messages.zoom;
    const chosen = list[Math.floor(Math.random() * list.length)];
    triggerAssistant(chosen);
  }

  function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ece8f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!state.image) {
      ui.emptyState = ui.emptyState || $('emptyState');
      ui.emptyState.hidden = false;
      ui.reviewBtn.disabled = true;
      ui.ratioStatus.textContent = 'Crop ratio: waiting';
      updateMeter();
      updateDashboard();
      return;
    }

    ui.emptyState = ui.emptyState || $('emptyState');
    ui.emptyState.hidden = true;
    ui.reviewBtn.disabled = false;

    const img = state.image;
    const base = Math.max(canvas.width / img.width, canvas.height / img.height) * state.zoom;
    const imgWidth = img.width * base;
    const imgHeight = img.height * base;

    ctx.save();
    ctx.translate(canvas.width / 2 + state.panX, canvas.height / 2 + state.panY);
    ctx.rotate((state.rotation * Math.PI) / 180);
    if (ui.mirrorToggle.checked) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(25, 18, 43, 0.47)';
    ctx.fillRect(0, 0, canvas.width, state.crop.y);
    ctx.fillRect(0, state.crop.y, state.crop.x, state.crop.size);
    ctx.fillRect(state.crop.x + state.crop.size, state.crop.y, canvas.width - state.crop.x - state.crop.size, state.crop.size);
    ctx.fillRect(0, state.crop.y + state.crop.size, canvas.width, canvas.height - state.crop.y - state.crop.size);

    ctx.strokeStyle = '#d8ff79';
    ctx.lineWidth = 3;
    ctx.strokeRect(state.crop.x, state.crop.y, state.crop.size, state.crop.size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(state.crop.x + 5, state.crop.y + 5, state.crop.size - 10, state.crop.size - 10);

    if (ui.gridToggle.checked) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i += 1) {
        const pos = state.crop.x + (state.crop.size / 3) * i;
        ctx.beginPath();
        ctx.moveTo(pos, state.crop.y);
        ctx.lineTo(pos, state.crop.y + state.crop.size);
        ctx.stroke();

        const yPos = state.crop.y + (state.crop.size / 3) * i;
        ctx.beginPath();
        ctx.moveTo(state.crop.x, yPos);
        ctx.lineTo(state.crop.x + state.crop.size, yPos);
        ctx.stroke();
      }
    }

    const handleSize = 10;
    ctx.fillStyle = '#d8ff79';
    [
      [state.crop.x, state.crop.y],
      [state.crop.x + state.crop.size, state.crop.y],
      [state.crop.x, state.crop.y + state.crop.size],
      [state.crop.x + state.crop.size, state.crop.y + state.crop.size]
    ].forEach(([x, y]) => {
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    });
    ctx.restore();

    ui.ratioStatus.textContent = 'Crop ratio: 1:1 (square, allegedly)';
    ui.positionStatus.textContent = `Position: ${Math.round(((state.panX / canvas.width) * 100) + 50)}%, ${Math.round(((state.panY / canvas.height) * 100) + 50)}%`;
    ui.zoomValue.textContent = `${state.zoom.toFixed(2)}×`;
    ui.rotateValue.textContent = `${Math.round(state.rotation)}°`;
    ui.reviewBtn.disabled = false;
    updateMeter();
    updateDashboard();
  }

  function makeExportCanvas() {
    if (!state.image) return null;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    const baseCtx = baseCanvas.getContext('2d');

    baseCtx.fillStyle = '#ece8f4';
    baseCtx.fillRect(0, 0, canvas.width, canvas.height);

    const img = state.image;
    const imageScale = Math.max(canvas.width / img.width, canvas.height / img.height) * state.zoom;
    const imageWidth = img.width * imageScale;
    const imageHeight = img.height * imageScale;

    baseCtx.save();
    baseCtx.translate(canvas.width / 2 + state.panX, canvas.height / 2 + state.panY);
    baseCtx.rotate((state.rotation * Math.PI) / 180);
    if (ui.mirrorToggle.checked) {
      baseCtx.scale(-1, 1);
    }
    baseCtx.drawImage(img, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    baseCtx.restore();

    const out = document.createElement('canvas');
    out.width = 512;
    out.height = 512;
    const outCtx = out.getContext('2d');
    outCtx.drawImage(
      baseCanvas,
      state.crop.x,
      state.crop.y,
      state.crop.size,
      state.crop.size,
      0,
      0,
      512,
      512
    );

    return out;
  }

  function renderResultPreview() {
    const exportCanvas = makeExportCanvas();
    if (!exportCanvas) return;

    resultCtx.clearRect(0, 0, 512, 512);
    resultCtx.drawImage(exportCanvas, 0, 0);
  }

  function downloadCurrentCrop() {
    const exportCanvas = makeExportCanvas();
    if (!exportCanvas) {
      showToast('Nothing to download yet. The committee is still waiting.', 'warn');
      return;
    }

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        showToast('Export failed. The pixels remain uncooperative.', 'warn');
        return;
      }

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'cropocalypse-profile-square.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      showToast('Downloaded! Your image is exactly 512 × 512 pixels.', 'success');
    }, 'image/png');
  }

  function openPixelModal() {
    if (state.pixelModalOpen) return;
    state.pixelModalOpen = true;
    ui.pixelModal.hidden = false;
    requestAnimationFrame(() => ui.fixPixelsBtn.focus());
  }

  function closePixelModal() {
    state.pixelModalOpen = false;
    ui.pixelModal.hidden = true;
  }

  function updateApprovalStage() {
    const current = approvalStages[state.approvalStage];
    const progress = ((state.approvalStage + 1) / approvalStages.length) * 100;
    ui.approvalStageTitle.textContent = current.title;
    ui.approvalStageCopy.textContent = current.description;
    ui.approvalProgressFill.style.width = `${progress}%`;
    ui.approvalStepLabel.textContent = `Stage ${state.approvalStage + 1} of ${approvalStages.length}`;
    ui.approvalBack.hidden = state.approvalStage === 0;
    ui.approvalNext.textContent = state.approvalStage === approvalStages.length - 1 ? 'Generate PNG' : 'Continue';
  }

  function openApprovalWorkflow() {
    state.approvalStage = 0;
    ui.approvalModal.hidden = false;
    updateApprovalStage();
    requestAnimationFrame(() => ui.approvalNext.focus());
  }

  function openCaptcha() {
    clearCaptchaDelay();
    state.captchaOpen = true;
    ui.captchaCheckbox.checked = false;
    ui.captchaVerify.disabled = true;
    ui.captchaVerify.textContent = 'Verify my humanity';
    ui.captchaCancel.disabled = false;
    ui.captchaClose.disabled = false;
    ui.captchaCountdown.hidden = true;
    ui.captchaModal.hidden = false;
    requestAnimationFrame(() => ui.captchaCheckbox.focus());
  }

  function clearCaptchaDelay() {
    if (state.captchaDelayTimer !== null) {
      window.clearTimeout(state.captchaDelayTimer);
      state.captchaDelayTimer = null;
    }
    if (state.captchaCountdownTimer !== null) {
      window.clearInterval(state.captchaCountdownTimer);
      state.captchaCountdownTimer = null;
    }
    if (ui.captchaCountdown) ui.captchaCountdown.hidden = true;
  }

  function closeCaptcha() {
    clearCaptchaDelay();
    state.captchaOpen = false;
    ui.captchaModal.hidden = true;
    ui.reviewBtn.focus();
  }

  function verifyCaptcha() {
    if (!ui.captchaCheckbox.checked || state.captchaDelayTimer !== null) return;

    ui.captchaCheckbox.disabled = true;
    ui.captchaVerify.disabled = true;
    ui.captchaCancel.disabled = true;
    ui.captchaClose.disabled = true;
    ui.captchaVerify.textContent = 'Please wait…';
    ui.captchaCountdown.hidden = false;
    let remainingSeconds = 5;
    ui.captchaCountdown.textContent = `Humanity assessment in progress… ${remainingSeconds}`;
    state.captchaCountdownTimer = window.setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds > 0) {
        ui.captchaCountdown.textContent = `Humanity assessment in progress… ${remainingSeconds}`;
      }
    }, 1000);
    state.captchaDelayTimer = window.setTimeout(() => {
      clearCaptchaDelay();
      state.captchaDelayTimer = null;
      state.captchaOpen = false;
      ui.captchaModal.hidden = true;
      ui.captchaCheckbox.disabled = false;
      ui.captchaVerify.textContent = 'Verify my humanity';
      ui.captchaCancel.disabled = false;
      ui.captchaClose.disabled = false;
      showToast('Humanity verified. The raccoons remain unconvinced.', 'success');
      openApprovalWorkflow();
    }, 5000);
  }

  function closeApprovalWorkflow() {
    ui.approvalModal.hidden = true;
  }

  function nextApprovalStage() {
    if (state.approvalStage < approvalStages.length - 1) {
      state.approvalStage += 1;
      updateApprovalStage();
      return;
    }

    const exportCanvas = makeExportCanvas();
    if (!exportCanvas) {
      showToast('No image is available for the committee to approve.', 'warn');
      return;
    }

    renderResultPreview();
    ui.resultPanel.hidden = false;
    ui.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeApprovalWorkflow();
    setStatus('Square crop generated. You survived the committee.', 'success');
    ui.approvalNote.textContent = 'Approved. You may now download the square image and reclaim your time.';
    triggerAchievement('Square Scholar');
    showToast('Final approval granted. The PNG is ready for download.', 'success');
  }

  function previousApprovalStage() {
    if (state.approvalStage > 0) {
      state.approvalStage -= 1;
      updateApprovalStage();
    }
  }

  function maybeMagneticResize(handle, dx, dy) {
    const config = chaosSettings[state.chaosMode];
    if (!config || Math.random() > config.adjustmentChance) return;

    const jitterX = Math.random() * 16 - 8;
    const jitterY = Math.random() * 16 - 8;
    if (handle.includes('w')) {
      state.crop.x = clamp(state.crop.x + jitterX, 18, state.crop.x + state.crop.size - 160);
    }
    if (handle.includes('e')) {
      state.crop.x = clamp(state.crop.x + jitterX, 18, canvas.width - state.crop.size - 18);
    }
    if (handle.includes('n')) {
      state.crop.y = clamp(state.crop.y + jitterY, 18, state.crop.y + state.crop.size - 160);
    }
    if (handle.includes('s')) {
      state.crop.y = clamp(state.crop.y + jitterY, 18, canvas.height - state.crop.size - 18);
    }

    showToast('Your crop box has developed opinions.', 'warn');
  }

  function maybeSnapCropAfterResize() {
    const config = chaosSettings[state.chaosMode];
    if (!config || Math.random() > config.snapChance) return;

    const centerX = state.crop.x + state.crop.size / 2;
    const centerY = state.crop.y + state.crop.size / 2;
    const sizeAdjustment = Math.round(Math.random() * 48 - 24);
    const maxSize = Math.min(canvas.width, canvas.height) - 36;

    state.crop.size = clamp(state.crop.size + sizeAdjustment, 160, maxSize);
    state.crop.x = centerX - state.crop.size / 2 + (Math.random() * 24 - 12);
    state.crop.y = centerY - state.crop.size / 2 + (Math.random() * 24 - 12);
    clampCrop();
    showToast('Crop engine reconsidering alignment.', 'warn');
  }

  function pointerLocation(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function handlePointerDown(event) {
    if (!state.image) return;
    const point = pointerLocation(event);
    const handle = detectHandle(point.x, point.y);

    state.dragging = true;
    state.dragMode = handle ? 'resize' : 'pan';
    state.resizeHandle = handle;
    state.lastPointer = point;
    state.dragStart = point;
    canvas.setPointerCapture(event.pointerId);

    if (state.dragMode === 'resize') {
      maybeMagneticResize(handle, 0, 0);
    }
  }

  function detectHandle(x, y) {
    const handleSize = 24;
    const corners = [
      { key: 'nw', x: state.crop.x, y: state.crop.y },
      { key: 'ne', x: state.crop.x + state.crop.size, y: state.crop.y },
      { key: 'sw', x: state.crop.x, y: state.crop.y + state.crop.size },
      { key: 'se', x: state.crop.x + state.crop.size, y: state.crop.y + state.crop.size }
    ];

    for (const corner of corners) {
      if (Math.abs(x - corner.x) <= handleSize && Math.abs(y - corner.y) <= handleSize) {
        return corner.key;
      }
    }
    return null;
  }

  function handlePointerMove(event) {
    if (!state.dragging) return;
    const point = pointerLocation(event);
    const dx = point.x - state.lastPointer.x;
    const dy = point.y - state.lastPointer.y;

    if (state.dragMode === 'pan') {
      state.panX += dx;
      state.panY += dy;
    } else if (state.dragMode === 'resize') {
      let x = state.crop.x;
      let y = state.crop.y;
      let size = state.crop.size;

      if (state.resizeHandle.includes('w')) {
        const leftLimit = 18;
        const candidate = state.crop.x + dx;
        const right = state.crop.x + state.crop.size;
        const minAllowed = right - 160;
        if (candidate >= leftLimit && candidate <= minAllowed) {
          x = candidate;
          size = right - candidate;
        }
      }

      if (state.resizeHandle.includes('e')) {
        const candidate = state.crop.size + dx;
        const maxAllowed = canvas.width - state.crop.x - 18;
        if (candidate >= 160 && candidate <= maxAllowed) {
          size = candidate;
        }
      }

      if (state.resizeHandle.includes('n')) {
        const topLimit = 18;
        const candidate = state.crop.y + dy;
        const bottom = state.crop.y + state.crop.size;
        const minAllowed = bottom - 160;
        if (candidate >= topLimit && candidate <= minAllowed) {
          y = candidate;
          size = bottom - candidate;
        }
      }

      if (state.resizeHandle.includes('s')) {
        const candidate = state.crop.size + dy;
        const maxAllowed = canvas.height - state.crop.y - 18;
        if (candidate >= 160 && candidate <= maxAllowed) {
          size = candidate;
        }
      }

      state.crop.x = clamp(x, 18, canvas.width - size - 18);
      state.crop.y = clamp(y, 18, canvas.height - size - 18);
      state.crop.size = clamp(size, 160, Math.min(canvas.width, canvas.height) - 36);
      maybeMagneticResize(state.resizeHandle, dx, dy);
    }

    state.lastPointer = point;
    renderCanvas();
  }

  function endPointerDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.dragMode === 'resize') {
      maybeSnapCropAfterResize();
      renderCanvas();
    }
    state.dragMode = 'pan';
    state.resizeHandle = null;
    state.nudgeCount += 1;
    updateMeter();
    updateDashboard();
  }

  function handleImageSelection(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file. The crop committee is strict.', 'warn');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.zoom = 1;
      state.rotation = 0;
      state.panX = 0;
      state.panY = 0;
      state.nudgeCount = 0;
      state.reviewCount = 0;
      fitCrop();
      syncZoomSlider();
      ui.fileName.textContent = file.name;
      ui.imageDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
      ui.noticeText.textContent = 'Reminder: drag inside the image to reposition it. Handles resize the square crop.';
      setStatus('Image loaded. The crop box is ready to be emotionally complicated.');
      renderCanvas();
      showToast('Image imported. Please prepare for unnecessary precision.', 'success');
      URL.revokeObjectURL(url);
      triggerAchievement('Professional Overthinker');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast('That image could not be opened. Try another file.', 'warn');
    };
    img.src = url;
  }

  function applyZoomFromSlider(value) {
    const raw = Number(value);
    state.zoom = clamp(3.5 - raw, 1, 2.5);
    state.nudgeCount += 1;
    syncZoomSlider();
    maybeChaosAdjustment();
    renderCanvas();
    ui.noticeText.textContent = 'Zoom department has made a recommendation. Please act casual.';
    ui.nudge.textContent = 'Zoom direction has been intentionally reversed. The interface is committed to confusion.';
    assistantMessageFor('zoom');
  }

  function applyRotation(value) {
    state.rotation = Number(value);
    state.nudgeCount += 1;
    ui.noticeText.textContent = 'The square committee is uncertain, but the rotation is still very real.';
    ui.nudge.textContent = 'Perfection has been temporarily reconsidered.';
    renderCanvas();
    assistantMessageFor('rotate');
    updateMeter();
  }

  function resetEverything() {
    state.zoom = 1;
    state.rotation = 0;
    state.panX = 0;
    state.panY = 0;
    state.nudgeCount = 0;
    fitCrop();
    syncZoomSlider();
    ui.rotateRange.value = '0';
    renderCanvas();
    ui.noticeText.textContent = 'Everything reset. The image is once again available for emotional reconsideration.';
    showToast('Everything reset. Your journey begins again.', 'info');
    triggerAchievement('Commitment Issues');
  }

  function toggleLabelChaos() {
    state.confusingLabels = ui.confuseToggle.checked;
    applyConfusingLabels();
    showToast(
      state.confusingLabels ? 'Labels are now extra confusing. You asked for this.' : 'Labels restored to their usual level of nonsense.',
      'info'
    );
  }

  function createAssistantMessage(message) {
    const entry = document.createElement('div');
    entry.className = 'assistant-message';
    entry.innerHTML = `<strong>CropGPT:</strong> ${message}`;
    ui.assistantBody.appendChild(entry);
    ui.assistantBody.scrollTop = ui.assistantBody.scrollHeight;
  }

  function startAssistant() {
    state.assistantVisible = true;
    ui.assistantPanel.hidden = false;
    createAssistantMessage('Your image contains a promising number of pixels.');
  }

  function setupEvents() {
    ui.imageInput.addEventListener('change', handleImageSelection);
    ui.zoomRange.addEventListener('input', (event) => applyZoomFromSlider(event.target.value));
    ui.rotateRange.addEventListener('input', (event) => applyRotation(event.target.value));
    ui.centerBtn.addEventListener('click', () => {
      state.panX = 0;
      state.panY = 0;
      state.nudgeCount += 1;
      ui.noticeText.textContent = 'The image has been re-centered. A rare moment of cooperation.';
      renderCanvas();
      assistantMessageFor('pan');
      showToast('Centered. The image would like to discuss the definition of center.', 'info');
    });

    ui.resetBtn.addEventListener('click', resetEverything);
    ui.gridToggle.addEventListener('change', renderCanvas);
    ui.mirrorToggle.addEventListener('change', () => {
      renderCanvas();
      showToast('Mirror preview toggled. Reality remains optional.', 'info');
    });
    ui.confuseToggle.addEventListener('change', toggleLabelChaos);
    ui.hintBtn.addEventListener('click', () => {
      ui.hintText.hidden = !ui.hintText.hidden;
      ui.hintText.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(ui.hintText.hidden ? 'Hint hidden. Mysterious.' : 'A hint has been revealed. It was hiding in plain sight.', 'info');
    });

    ui.reviewBtn.addEventListener('click', () => {
      if (!state.image) {
        showToast('Upload an image first. Even chaos has a sequence.', 'warn');
        return;
      }
      state.reviewCount += 1;
      renderResultPreview();
      openCaptcha();
      showToast('A fake CAPTCHA has entered the review process.', 'info');
      triggerAchievement('Approval Seeker');
    });

    ui.saveBtn.addEventListener('click', downloadCurrentCrop);
    ui.backBtn.addEventListener('click', () => {
      ui.resultPanel.hidden = true;
      canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    ui.approvalBack.addEventListener('click', previousApprovalStage);
    ui.approvalNext.addEventListener('click', nextApprovalStage);
    ui.approvalClose.addEventListener('click', closeApprovalWorkflow);
    ui.captchaCheckbox.addEventListener('change', () => {
      ui.captchaVerify.disabled = !ui.captchaCheckbox.checked;
    });
    ui.captchaVerify.addEventListener('click', verifyCaptcha);
    ui.captchaClose.addEventListener('click', closeCaptcha);
    ui.captchaCancel.addEventListener('click', closeCaptcha);
    ui.captchaModal.addEventListener('click', (event) => {
      if (event.target === ui.captchaModal) closeCaptcha();
    });

    ui.fixPixelsBtn.addEventListener('click', () => {
      closePixelModal();
      const adjust = state.chaosMode === 'max' ? 0.18 : 0.12;
      state.zoom = clamp(state.zoom + (Math.random() > 0.5 ? adjust : -adjust), 1, 2.5);
      syncZoomSlider();
      renderCanvas();
      showToast('The Pixel Department has supervised a minor correction.', 'success');
    });

    ui.ignorePixelsBtn.addEventListener('click', () => {
      closePixelModal();
      showToast('Pixels were ignored. The image is still doing fine.', 'info');
    });

    ui.pixelClose.addEventListener('click', closePixelModal);
    ui.normalModeBtn.addEventListener('click', () => {
      state.chaosMode = 'mild';
      ui.chaosMode.value = 'mild';
      showToast('Normal mode restored. The chaos has been officially rebranded.', 'success');
    });

    ui.chaosMode.addEventListener('change', (event) => {
      state.chaosMode = event.target.value;
      showToast(`Chaos mode set to ${state.chaosMode}.` , 'info');
      renderCanvas();
    });

    ui.assistantMinimize.addEventListener('click', () => {
      state.assistantMinimized = !state.assistantMinimized;
      ui.assistantPanel.classList.toggle('minimized', state.assistantMinimized);
    });

    ui.assistantClose.addEventListener('click', () => {
      state.assistantVisible = false;
      ui.assistantPanel.hidden = true;
    });

    ui.footerHelp.addEventListener('click', () => {
      ui.hintText.hidden = false;
      ui.hintText.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Help activated. The interface has reluctantly cooperated.', 'info');
    });

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', endPointerDrag);
    canvas.addEventListener('pointercancel', endPointerDrag);
    canvas.addEventListener('dblclick', () => {
      if (!state.image) return;
      state.panX = 0;
      state.panY = 0;
      renderCanvas();
      showToast('Double-click re-centered the image. A rare moment of cooperation.', 'info');
      assistantMessageFor('pan');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePixelModal();
        if (state.captchaOpen) {
          if (state.captchaDelayTimer === null) closeCaptcha();
        } else {
          closeApprovalWorkflow();
        }
      }
    });
  }

  function initialize() {
    fitCrop();
    state.chaosMode = 'mild';
    ui.chaosMode.value = 'mild';
    ui.pixelModal.hidden = true;
    ui.captchaModal.hidden = true;
    ui.approvalModal.hidden = true;
    ui.resultPanel.hidden = true;
    ui.hintText.hidden = true;
    ui.assistantPanel.hidden = false;
    applyConfusingLabels();
    updateMeter();
    updateDashboard();
    renderCanvas();
    setupEvents();
    createAssistantMessage('Your image contains a promising number of pixels.');
    showToast('Cropocalypse is online. The interface is ready to be inconvenient.', 'info');
    pixelModalTimer = window.setInterval(maybeTriggerPixelModal, pixelModalInterval);
  }

  initialize();
})();
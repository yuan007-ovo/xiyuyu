// ==========================================
// IndexedDB 异步存储引擎 (突破 5MB 限制，无限存储)
// ==========================================
const CHAT_DB_NAME = 'ChatAppDB_V1';
const CHAT_STORE_NAME = 'chat_data_store';
let chatDBInstance = null;
window.ChatMemoryCache = {}; 

// 封装的 ChatDB 对象，完美替代 localStorage
window.ChatDB = {
    getItem: function(key) {
        return window.ChatMemoryCache.hasOwnProperty(key) ? window.ChatMemoryCache[key] : null;
    },
    setItem: function(key, value) {
        window.ChatMemoryCache[key] = value; // 同步更新内存，保证页面不卡顿
        if (chatDBInstance) {
            const tx = chatDBInstance.transaction(CHAT_STORE_NAME, 'readwrite');
            tx.objectStore(CHAT_STORE_NAME).put({ key: key, value: value });
        } else {
            try { localStorage.setItem(key, value); } catch(e){} // 兜底
        }
    },
    removeItem: function(key) {
        delete window.ChatMemoryCache[key];
        try { localStorage.removeItem(key); } catch(e){} // 强制清理 localStorage 中的残留，防止老数据变成“僵尸”复活
        if (chatDBInstance) {
            const tx = chatDBInstance.transaction(CHAT_STORE_NAME, 'readwrite');
            tx.objectStore(CHAT_STORE_NAME).delete(key);
        }
    }
};

// 立即初始化并自动迁移老数据
(function initChatDB() {
    const request = indexedDB.open(CHAT_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
            db.createObjectStore(CHAT_STORE_NAME, { keyPath: 'key' });
        }
    };
    request.onsuccess = (e) => {
        chatDBInstance = e.target.result;
        const tx = chatDBInstance.transaction(CHAT_STORE_NAME, 'readonly');
        const store = tx.objectStore(CHAT_STORE_NAME);
        const getAllReq = store.getAll();
        
        getAllReq.onsuccess = () => {
            const dbData = getAllReq.result;
            // 1. 加载 DB 数据到内存
            dbData.forEach(item => {
                window.ChatMemoryCache[item.key] = item.value;
            });

            // 2. 自动迁移 localStorage 里的老数据 (无损过渡)
            let migrated = false;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const val = localStorage.getItem(key);
                if (!window.ChatMemoryCache.hasOwnProperty(key)) {
                    window.ChatMemoryCache[key] = val;
                    const writeTx = chatDBInstance.transaction(CHAT_STORE_NAME, 'readwrite');
                    writeTx.objectStore(CHAT_STORE_NAME).put({ key: key, value: val });
                    migrated = true;
                }
            }
            if (migrated) console.log("老数据已成功迁移至 IndexedDB！");
            
            // 触发数据库就绪事件，通知 UI 恢复状态
            window.dispatchEvent(new Event('ChatDBReady'));
        };
    };
    request.onerror = (e) => console.error("IndexedDB 初始化失败", e);
})();
// ==========================================

// ==========================================
// iOS Standalone (全屏) 模式检测与防缩放
// ==========================================
function initStandaloneMode() {
    const isIosStandalone = window.navigator.standalone === true;
    const isMatchMediaStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIosStandalone || isMatchMediaStandalone) {
        document.body.classList.add('ios-standalone');
        console.log("✅ 当前运行在 Standalone 全屏模式");
    }

    // 彻底禁止双指缩放 (Pinch-to-zoom)
    document.addEventListener('touchmove', function(event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });
}

initStandaloneMode();

// ==========================================
// iOS / PWA 全屏与键盘自适应最终版 (兼容安卓防黑屏)
// ==========================================
function updateAppViewportVars() {
    const docStyle = document.documentElement.style;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS && window.visualViewport) {
        // 🍎 iOS 专属逻辑：用 screen.height 减去 visualViewport.height 来精准判断键盘！
        const isKeyboardOpen = (window.screen.height - window.visualViewport.height) > 150;
        
        if (isKeyboardOpen) {
            // 键盘弹起时，高度缩小到可视区域，把弹窗、输入框完美“托”上来
            docStyle.setProperty('--app-height', `${window.visualViewport.height}px`);
        } else {
            // 键盘收起时，恢复最大高度，彻底消灭底部的黑边！
            const candidates = [
                window.innerHeight,
                document.documentElement.clientHeight,
                window.visualViewport.height
            ];
            if (window.navigator.standalone === true) {
                candidates.push(window.screen.height);
            }
            const fullHeight = Math.max(...candidates);
            docStyle.setProperty('--app-height', `${fullHeight}px`);
        }
        
        // 强制回滚到顶部，防止 iOS 默认的滚动推移导致错位
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
    } else {
        // 🤖 安卓及其他设备逻辑：安卓键盘弹出时会自动调整 innerHeight，直接使用即可
        const fallbackHeight = window.innerHeight;
        docStyle.setProperty('--app-height', `${fallbackHeight}px`);
    }
}

// 监听可视区域变化（键盘弹出/收起）
let viewportResizeTimer = null;
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        if (viewportResizeTimer) clearTimeout(viewportResizeTimer);
        viewportResizeTimer = setTimeout(() => {
            updateAppViewportVars();
            // 【性能优化】：只有在聊天室显示时才去操作滚动，避免后台无效计算
            const chatHistory = document.getElementById('chatRoomHistory');
            if (chatHistory && document.getElementById('chatRoomPanel').style.display === 'flex') {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        }, 150); // 延迟 150ms，等屏幕完全稳定后再计算，极其丝滑
    });
    
    window.visualViewport.addEventListener('scroll', () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }
    });
} else {
    window.addEventListener('resize', updateAppViewportVars);
}

// 监听输入框失去焦点（键盘收起），强制重置页面位置，防止页面卡在半空中漏出白边
document.addEventListener('focusout', () => {
    setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        updateAppViewportVars();
    }, 50);
});

// 初始化调用一次
updateAppViewportVars();

// ==========================================
// 通用输入框确认按钮事件绑定（保留原有逻辑）
// ==========================================
const generalConfirmBtn = document.getElementById('wc-general-input-confirm');
if (generalConfirmBtn) {
    generalConfirmBtn.onclick = function() {
        const textInput = document.getElementById('wc-general-input-field');
        const passInput = document.getElementById('wc-general-password-field');
        const val = (passInput && passInput.style.display === 'block') ? passInput.value : textInput.value;
        
        if (typeof wcState !== 'undefined' && wcState.generalInputCallback) {
            wcState.generalInputCallback(val);
        }
        if (typeof wcCloseModal === 'function') {
            wcCloseModal('wc-modal-general-input');
        }
    };
}

// 监听模拟器聊天输入框（保留原有逻辑）
const simInput = document.getElementById('wc-sim-chat-input');
if (simInput) {
    simInput.addEventListener('input', function() {
        const sendBtn = document.getElementById('wc-sim-send-btn');
        const aiBtn = document.getElementById('wc-sim-ai-btn');
        if (this.value.trim().length > 0) {
            if (sendBtn) sendBtn.style.display = 'block';
            if (aiBtn) aiBtn.style.display = 'none';
        } else {
            if (sendBtn) sendBtn.style.display = 'none';
            if (aiBtn) aiBtn.style.display = 'flex';
        }
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    simInput.addEventListener('focus', () => {
        setTimeout(() => {
            const container = document.getElementById('wc-sim-chat-history');
            if (container) container.scrollTop = container.scrollHeight;
        }, 300);
    });
}

// ==========================================
// 业务逻辑：面板、上传、壁纸、字体等
// ==========================================

// --- 主题面板开关 ---
const themePanel = document.getElementById('themePanel');
function openThemePanel() { themePanel.style.display = 'flex'; }
function closeThemePanel() { themePanel.style.display = 'none'; }

// --- 设置全屏页面与 API 面板逻辑 ---
const settingsFullScreenPanel = document.getElementById('settingsFullScreenPanel');
function openSettingsPanel() {
    settingsFullScreenPanel.style.display = 'flex';
}
function closeSettingsFullScreenPanel() {
    settingsFullScreenPanel.style.display = 'none';
    document.getElementById('settingsPopup').classList.remove('show');
}

// 主题页面弹窗逻辑
function toggleThemePopup() {
    document.getElementById('themePopup').classList.toggle('show');
}

// 设置页面弹窗逻辑
function toggleSettingsPopup() {
    document.getElementById('settingsPopup').classList.toggle('show');
}

// 点击空白处关闭设置弹窗和主题弹窗
document.addEventListener('click', (e) => {
    const settingsPopup = document.getElementById('settingsPopup');
    const settingsHeaderDots = document.querySelector('#settingsFullScreenPanel .header-dots');
    if (settingsPopup && settingsPopup.classList.contains('show') && !settingsPopup.contains(e.target) && !settingsHeaderDots.contains(e.target)) {
        settingsPopup.classList.remove('show');
    }

    const themePopup = document.getElementById('themePopup');
    const themeHeaderDots = document.querySelector('#themePanel .header-dots');
    if (themePopup && themePopup.classList.contains('show') && !themePopup.contains(e.target) && !themeHeaderDots.contains(e.target)) {
        themePopup.classList.remove('show');
    }
});

let currentExportType = ''; // 'theme' 或 'all'

function showExportModal(type, e) {
    if(e) e.stopPropagation();
    currentExportType = type;
    document.getElementById('settingsPopup').classList.remove('show');
    const themePopup = document.getElementById('themePopup');
    if(themePopup) themePopup.classList.remove('show');
    document.getElementById('exportNameInput').value = type === 'theme' ? 'theme_data' : 'all_backup_data';
    document.getElementById('exportModalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('exportNameInput').focus(), 100);
}

function hideExportModal() {
    document.getElementById('exportModalOverlay').classList.remove('show');
}

async function confirmExport() {
    let fileName = document.getElementById('exportNameInput').value.trim();
    if (!fileName) fileName = 'backup_data';
    if (!fileName.endsWith('.json')) fileName += '.json';

    if (currentExportType === 'theme') {
        const state = await getGlobalStateFromDB() || captureFullState();
        const dataStr = JSON.stringify(state, null, 2);
        downloadJson(dataStr, fileName);
    } else if (currentExportType === 'all') {
        const state = await getGlobalStateFromDB() || captureFullState();
        const presets = await getAllPresets();
        
        // 收集所有 ChatDB 数据
        const chatDBData = {};
        for (let key in window.ChatMemoryCache) {
            chatDBData[key] = window.ChatMemoryCache[key];
        }

        // 收集所有 localStorage 数据 (双重保险，确保没有任何遗漏)
        const localData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            localData[key] = localStorage.getItem(key);
        }
        
        const allData = { state, presets, chatDBData, localData };
        const dataStr = JSON.stringify(allData, null, 2);
        downloadJson(dataStr, fileName);
    }
    hideExportModal();
}

// 导出桌面美化数据 (不包含API)
async function exportThemeData(e) {
    showExportModal('theme', e);
}

// 导入桌面美化数据
function importThemeData(e) {
    if(e) e.stopPropagation();
    uploadJson(async (data) => {
        if (data && typeof data === 'object' && !data.apiConfig) {
            applyFullState(data);
            await saveGlobalStateToDB(data);
            alert('桌面美化数据导入成功！');
        } else {
            alert('无效的数据格式，请确保导入的是桌面美化数据');
        }
    });
    const themePopup = document.getElementById('themePopup');
    if(themePopup) themePopup.classList.remove('show');
}

// 导出所有数据 (包含API、预设等)
async function exportAllData(e) {
    showExportModal('all', e);
}

// 数据储存分析
async function showStorageAnalysisModal() {
    document.getElementById('storageModalOverlay').classList.add('show');
    
    // 估算数据大小
    const state = await getGlobalStateFromDB() || captureFullState();
    const presets = await getAllPresets();
    const apiConfig = ChatDB.getItem('current_api_config') || '{}';
    const apiPresets = ChatDB.getItem('api_presets') || '[]';
    const wbDataStr = ChatDB.getItem('worldbook_data') || '{}'; 
    
    // 收集 Chat 相关数据
    let chatDataSize = 0;
    for (let key in window.ChatMemoryCache) {
        if (key !== 'current_api_config' && key !== 'api_presets' && key !== 'worldbook_data' && key !== 'ios_immersive_mode' && key !== 'ios_statusbar_hidden') {
            chatDataSize += new Blob([window.ChatMemoryCache[key]]).size;
        }
    }
    
    const stateSize = new Blob([JSON.stringify(state)]).size;
    const presetsSize = new Blob([JSON.stringify(presets)]).size;
    const apiSize = new Blob([apiConfig, apiPresets]).size;
    const wbSize = new Blob([wbDataStr]).size; 
    
    const totalSize = stateSize + presetsSize + apiSize + wbSize + chatDataSize || 1; 
    
    const statePct = Math.round((stateSize / totalSize) * 100);
    const presetsPct = Math.round((presetsSize / totalSize) * 100);
    const apiPct = Math.round((apiSize / totalSize) * 100);
    const wbPct = Math.round((wbSize / totalSize) * 100);
    const chatPct = 100 - statePct - presetsPct - apiPct - wbPct; 
    
    // 绘制扇形图 (使用 conic-gradient)
    const chart = document.getElementById('storagePieChart');
    chart.style.background = `conic-gradient(
        #34c759 0% ${statePct}%, 
        #007aff ${statePct}% ${statePct + presetsPct}%, 
        #ff9500 ${statePct + presetsPct}% ${statePct + presetsPct + apiPct}%,
        #af52de ${statePct + presetsPct + apiPct}% ${statePct + presetsPct + apiPct + wbPct}%,
        #ff2d55 ${statePct + presetsPct + apiPct + wbPct}% 100%
    )`;
    
    // 更新图例
    const legend = document.getElementById('storageLegend');
    legend.innerHTML = `
        <div class="legend-item"><span class="legend-color" style="background:#34c759;"></span>当前状态 (${statePct}%) - ${(stateSize/1024).toFixed(1)}KB</div>
        <div class="legend-item"><span class="legend-color" style="background:#007aff;"></span>预设库 (${presetsPct}%) - ${(presetsSize/1024).toFixed(1)}KB</div>
        <div class="legend-item"><span class="legend-color" style="background:#ff9500;"></span>API配置 (${apiPct}%) - ${(apiSize/1024).toFixed(1)}KB</div>
        <div class="legend-item"><span class="legend-color" style="background:#af52de;"></span>世界书 (${wbPct}%) - ${(wbSize/1024).toFixed(1)}KB</div>
        <div class="legend-item"><span class="legend-color" style="background:#ff2d55;"></span>聊天数据 (${chatPct}%) - ${(chatDataSize/1024).toFixed(1)}KB</div>
    `;
}

function hideStorageAnalysisModal() {
    document.getElementById('storageModalOverlay').classList.remove('show');
}

// 导入所有数据 (修复异步写入丢失与旧数据残留问题)
function importAllData(e) {
    if(e) e.stopPropagation();
    uploadJson(async (data) => {
        if (data && data.state) {
            // 1. 恢复桌面状态
            applyFullState(data.state);
            await saveGlobalStateToDB(data.state);
            
            // 2. 恢复预设库
            if (data.presets && Array.isArray(data.presets)) {
                for (const p of data.presets) {
                    await savePresetToDB(p);
                }
            }
            
            // 3. 恢复 ChatDB 核心数据 (确保异步写入完成)
            if (data.chatDBData && chatDBInstance) {
                // 开启读写事务
                const tx = chatDBInstance.transaction(CHAT_STORE_NAME, 'readwrite');
                const store = tx.objectStore(CHAT_STORE_NAME);
                
                // 先清空当前所有旧数据，防止新旧数据污染
                store.clear();
                window.ChatMemoryCache = {}; 
                
                // 批量写入新数据
                for (let key in data.chatDBData) {
                    store.put({ key: key, value: data.chatDBData[key] });
                    window.ChatMemoryCache[key] = data.chatDBData[key]; // 同步更新内存
                }
                
                // 监听事务完成事件，确保 100% 写入硬盘后再刷新
                tx.oncomplete = () => {
                    alert('所有数据导入成功！即将刷新页面...');
                    location.reload();
                };
                tx.onerror = () => {
                    alert('数据写入硬盘失败，请重试！');
                };
            } else {
                // 兼容极早期老版本备份
                if (data.apiConfig) ChatDB.setItem('current_api_config', JSON.stringify(data.apiConfig));
                if (data.apiPresets) ChatDB.setItem('api_presets', JSON.stringify(data.apiPresets));
                setTimeout(() => {
                    alert('所有数据导入成功！即将刷新页面...');
                    location.reload();
                }, 800); // 给老方法留出足够的异步写入时间
            }
        } else {
            alert('无效的数据格式，请确保导入的是完整备份数据');
        }
    });
    document.getElementById('settingsPopup').classList.remove('show');
}

function checkUpdate(e) {
    if(e) e.stopPropagation();
    document.getElementById('settingsPopup').classList.remove('show');
    alert('正在检查更新...');
    setTimeout(() => {
        location.reload(true);
    }, 500);
}

function clearAllData(e) {
    if(e) e.stopPropagation();
    document.getElementById('settingsPopup').classList.remove('show');
    if (confirm('警告：此操作将清空所有本地数据（包括聊天记录、角色、设置、音乐等），且不可恢复！\n\n确定要清空所有数据吗？')) {
        if (confirm('再次确认：真的要清空所有数据吗？')) {
            localStorage.clear();
            if (chatDBInstance) {
                const tx = chatDBInstance.transaction(CHAT_STORE_NAME, 'readwrite');
                tx.objectStore(CHAT_STORE_NAME).clear();
                tx.oncomplete = () => {
                    alert('所有数据已清空，即将刷新页面。');
                    location.reload();
                };
            } else {
                alert('所有数据已清空，即将刷新页面。');
                location.reload();
            }
        }
    }
}

// 辅助函数：下载JSON
function downloadJson(jsonStr, filename) {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// 辅助函数：上传JSON
function uploadJson(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                callback(data);
            } catch (err) {
                alert('解析JSON失败');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ==========================================
// 全屏与状态栏开关持久化逻辑
// ==========================================
const fsToggle = document.getElementById('fullscreenToggle');
const sbToggle = document.getElementById('statusBarToggle');
const iphoneContainer = document.getElementById('iphone-container');
const statusBar = document.querySelector('.status-bar');

// 监听数据库就绪事件，确保能读到数据后再恢复开关状态
window.addEventListener('ChatDBReady', () => {
    if (ChatDB.getItem('ios_immersive_mode') === 'true') {
        if (fsToggle) fsToggle.checked = true;
        if (iphoneContainer) iphoneContainer.classList.add('immersive-mode');
    }
    if (ChatDB.getItem('ios_statusbar_hidden') === 'true') {
        if (sbToggle) sbToggle.checked = false;
        if (statusBar) statusBar.style.opacity = '0';
        if (iphoneContainer) iphoneContainer.classList.add('hide-status-bar');
    } else {
        if (iphoneContainer) iphoneContainer.classList.remove('hide-status-bar');
    }
    
    // 恢复桌面布局顺序并绑定拖拽事件
    restoreDesktopOrder();
    bindDesktopLongPress();
});

// ==========================================
// 系统通知与提示音设置逻辑
// ==========================================
let tempSoundData = '';

function openNotifSettingsModal() {
    // 读取通知模式
    const notifMode = ChatDB.getItem('sys_notif_mode') || 'off';
    document.getElementById('modalSysNotifMode').value = notifMode;

    // 读取提示音
    const savedSound = ChatDB.getItem('sys_notif_sound') || '';
    document.getElementById('soundUrlInput').value = savedSound.startsWith('data:audio') ? '' : savedSound;
    const preview = document.getElementById('soundPreview');
    if (savedSound) {
        preview.src = savedSound;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
    
    tempSoundData = ''; // 重置临时音频数据
    document.getElementById('notifSettingsModalOverlay').classList.add('show');
}

function closeNotifSettingsModal() {
    document.getElementById('notifSettingsModalOverlay').classList.remove('show');
    document.getElementById('soundPreview').pause();
}

function handleSoundFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            tempSoundData = e.target.result;
            const preview = document.getElementById('soundPreview');
            preview.src = tempSoundData;
            preview.style.display = 'block';
            preview.play();
            document.getElementById('soundUrlInput').value = ''; // 清空URL
        };
        reader.readAsDataURL(file);
    }
}

function saveNotifSettings() {
    // 1. 保存通知模式
    const mode = document.getElementById('modalSysNotifMode').value;
    if (mode !== 'off') {
        if ("Notification" in window) {
            Notification.requestPermission().then(permission => {
                if (permission !== "granted") {
                    alert("请在浏览器设置中允许通知权限！");
                    ChatDB.setItem('sys_notif_mode', 'off');
                } else {
                    ChatDB.setItem('sys_notif_mode', mode);
                }
            });
        } else {
            alert("您的浏览器不支持系统通知！");
            ChatDB.setItem('sys_notif_mode', 'off');
        }
    } else {
        ChatDB.setItem('sys_notif_mode', mode);
    }

    // 2. 保存提示音
    const urlVal = document.getElementById('soundUrlInput').value.trim();
    if (urlVal) {
        ChatDB.setItem('sys_notif_sound', urlVal);
    } else if (tempSoundData) {
        ChatDB.setItem('sys_notif_sound', tempSoundData);
    } else {
        ChatDB.removeItem('sys_notif_sound');
    }

    alert('通知与提示音设置保存成功！');
    closeNotifSettingsModal();
}

// 监听全屏开关
if (fsToggle) {
    fsToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            iphoneContainer.classList.add('immersive-mode');
            ChatDB.setItem('ios_immersive_mode', 'true');
        } else {
            iphoneContainer.classList.remove('immersive-mode');
            ChatDB.setItem('ios_immersive_mode', 'false');
        }
    });
}

// 监听状态栏开关
if (sbToggle) {
    sbToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            statusBar.style.opacity = '1';
            iphoneContainer.classList.remove('hide-status-bar');
            ChatDB.setItem('ios_statusbar_hidden', 'false');
        } else {
            statusBar.style.opacity = '0';
            iphoneContainer.classList.add('hide-status-bar');
            ChatDB.setItem('ios_statusbar_hidden', 'true');
        }
    });
}

// ==========================================
// 后台保活逻辑 (无声音频 + WakeLock)
// ==========================================
let keepAliveAudio = null;
let wakeLock = null;

function initKeepAlive() {
    if (!keepAliveAudio) {
        // 极短的无声 WAV 音频 Base64
        keepAliveAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        keepAliveAudio.loop = true;
        keepAliveAudio.volume = 0.01;
        // 允许在后台和静音模式下播放
        keepAliveAudio.setAttribute('playsinline', '');
        keepAliveAudio.setAttribute('webkit-playsinline', '');
    }
}

async function toggleKeepAlive(enable) {
    initKeepAlive();
    if (enable) {
        try {
            await keepAliveAudio.play();
            console.log("✅ 后台保活音频已启动");
        } catch (e) {
            console.log("⚠️ 保活音频播放失败，等待用户交互后启动", e);
        }
        
        // 尝试请求 WakeLock (保持屏幕常亮，防止休眠杀后台)
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log("✅ WakeLock 已激活");
            } catch (err) {
                console.log("⚠️ WakeLock 请求失败:", err);
            }
        }
        ChatDB.setItem('app_keep_alive', 'true');
    } else {
        keepAliveAudio.pause();
        if (wakeLock !== null) {
            wakeLock.release().then(() => { wakeLock = null; });
        }
        ChatDB.setItem('app_keep_alive', 'false');
        console.log("❌ 后台保活已关闭");
    }
}

// 监听可见性变化，如果开启了保活，在重新可见时重新请求 WakeLock
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    }
});

// 页面加载时初始化开关状态
window.addEventListener('ChatDBReady', () => {
    const keepAliveToggle = document.getElementById('keepAliveToggle');
    const isKeepAlive = ChatDB.getItem('app_keep_alive') === 'true';
    
    if (keepAliveToggle) {
        keepAliveToggle.checked = isKeepAlive;
        keepAliveToggle.addEventListener('change', (e) => {
            toggleKeepAlive(e.target.checked);
        });
    }

    // 如果开启了保活，由于浏览器限制自动播放，需要在第一次用户点击屏幕时启动
    if (isKeepAlive) {
        const startKeepAlive = () => {
            toggleKeepAlive(true);
            document.removeEventListener('click', startKeepAlive);
            document.removeEventListener('touchstart', startKeepAlive);
        };
        document.addEventListener('click', startKeepAlive);
        document.addEventListener('touchstart', startKeepAlive);
    }
});

// ==========================================
// API 面板与数据持久化逻辑
// ==========================================
const apiPanel = document.getElementById('apiPanel');

// 页面加载时恢复 API 数据 (等待数据库就绪)
window.addEventListener('ChatDBReady', () => {
    const savedApi = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (savedApi.url) document.getElementById('apiUrl').value = savedApi.url;
    if (savedApi.key) document.getElementById('apiKey').value = savedApi.key;
    if (savedApi.model) {
        const select = document.getElementById('apiModel');
        select.innerHTML = `<option value="${savedApi.model}">${savedApi.model}</option>`;
    }
    if (savedApi.temperature !== undefined) {
        document.getElementById('apiTemperature').value = savedApi.temperature;
        document.getElementById('apiTempValue').innerText = savedApi.temperature;
    }
});

function openApiPanel() {
    apiPanel.style.display = 'flex';
    renderApiPresets();
}

function closeApiPanel() { 
    apiPanel.style.display = 'none'; 
    document.getElementById('apiPresetPopup').classList.remove('show');
}

// --- Worldbook 面板逻辑 ---
const wbListPanel = document.getElementById('wbListPanel');
const wbEditPanel = document.getElementById('wbEditPanel');

window.reloadWorldbookData = function() {
    wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || {
        groups: ['默认分组'],
        entries: []
    };
    if (typeof renderWbGroups === 'function') renderWbGroups();
    if (typeof renderWbList === 'function') renderWbList();
};

function openWorldbookPanel() {
    window.reloadWorldbookData();
    wbListPanel.style.display = 'flex';
}

function closeWorldbookPanel() {
    wbListPanel.style.display = 'none';
}

function openWbEditPanel() {
    wbEditPanel.style.display = 'flex';
    wbListPanel.style.display = 'none'; // 打开编辑页时隐藏列表页
}

function closeWbEditPanel() {
    wbEditPanel.style.display = 'none';
    wbListPanel.style.display = 'flex'; // 关闭编辑页时回到列表页
}

// --- Worldbook 核心逻辑 (数据存储与渲染) ---
let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || {
    groups: ['默认分组'], // 只保留默认分组
    entries: []
};

let currentWbGroupFilter = '默认分组'; // 当前查看的分组

// 保存数据到本地 (确保刷新不丢失)
function saveWbData() {
    ChatDB.setItem('worldbook_data', JSON.stringify(wbData));
}

// 渲染列表页的词条 (支持分组过滤)
function renderWbList() {
    const listEl = document.getElementById('wbEntryList');
    listEl.innerHTML = '';
    
    // 如果选择的是“默认分组”，则显示所有词条；否则只显示对应分组的词条
    const filteredEntries = currentWbGroupFilter === '默认分组' 
        ? wbData.entries 
        : wbData.entries.filter(e => e.group === currentWbGroupFilter);
    
    if (filteredEntries.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#aaa; font-size:12px; padding:20px;">该分组下暂无世界书词条</div>';
        return;
    }

    filteredEntries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'wb-file-card';
        card.onclick = () => editWbEntry(entry.id);
        
        // 判断五角星是实心(激活)还是空心(未激活)，无圆圈包裹，并加上 class
        const starSvg = entry.active 
            ? `<svg class="wb-file-star" viewBox="0 0 24 24" fill="#333"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`
            : `<svg class="wb-file-star" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;

        card.innerHTML = `
            <!-- 新增 wrap 层用于承载阴影，防止被 clip-path 切掉 -->
            <div class="wb-file-paper-wrap">
                <div class="wb-file-paper">
                    <!-- 右上角折角与五角星 -->
                    <div class="wb-file-fold" onclick="event.stopPropagation(); toggleWbEntryActive('${entry.id}')">
                        ${starSvg}
                    </div>
                    <!-- 文件内部：左上角分组 -->
                    <div class="wb-file-group">${entry.group}</div>
                    <!-- 文件内部：横线与内容 -->
                    <div class="wb-file-content">${entry.content || ''}</div>
                    <!-- 新增：右下角删除按钮 (浅灰色垃圾桶) -->
                    <div class="wb-file-delete" onclick="event.stopPropagation(); deleteWbEntryFromList('${entry.id}')">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#b0b0b0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>

                </div>
            </div>
            <!-- 文件外部：下方名称 -->
            <div class="wb-file-title">${entry.title || '未命名'}</div>
        `;
        listEl.appendChild(card);
    });
}

// 列表页快捷删除词条
function deleteWbEntryFromList(id) {
    if (confirm('确定要删除这个世界书词条吗？')) {
        wbData.entries = wbData.entries.filter(e => e.id !== id);
        saveWbData();
        renderWbList();
    }
}

// 导入世界书文件
function importWbEntry() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.doc,.docx';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { groups: ['默认分组'], entries: [] };

        // 专门处理 docx 格式
        if (file.name.endsWith('.docx')) {
            if (typeof mammoth === 'undefined') {
                alert('缺少 docx 解析库，请检查网络连接！');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                const arrayBuffer = event.target.result;
                mammoth.extractRawText({arrayBuffer: arrayBuffer})
                    .then(function(result) {
                        const text = result.value;
                        importAsText(fileName, text);
                        ChatDB.setItem('worldbook_data', JSON.stringify(wbData));
                        renderWbList();
                    })
                    .catch(function(err) {
                        alert('docx 解析失败: ' + err.message);
                    });
            };
            reader.readAsArrayBuffer(file);
        } 
        // 拦截古老的 doc 格式
        else if (file.name.endsWith('.doc')) {
            alert('抱歉宝宝，.doc 是非常古老的二进制格式，浏览器无法直接完美解析，建议另存为 .docx 或 .txt 后导入哦~');
        } 
        // 处理 txt 和 json 格式
        else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                
                if (file.name.endsWith('.json')) {
                    try {
                        const data = JSON.parse(content);
                        let entriesToImport = [];

                        // 1. 兼容酒馆 (SillyTavern) 的 Lorebook 格式
                        if (data.entries) {
                            const entriesArray = Array.isArray(data.entries) ? data.entries : Object.values(data.entries);
                            entriesArray.forEach(item => {
                                let kw = '';
                                if (Array.isArray(item.key)) kw = item.key.join(', ');
                                else if (Array.isArray(item.keys)) kw = item.keys.join(', ');
                                else if (typeof item.key === 'string') kw = item.key;
                                else if (typeof item.keys === 'string') kw = item.keys;

                                entriesToImport.push({
                                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                    active: item.enabled !== false && item.disable !== true,
                                    title: item.comment || item.name || '未命名',
                                    group: currentWbGroupFilter === '默认分组' ? wbData.groups[0] : currentWbGroupFilter,
                                    position: 'before',
                                    constant: !!item.constant,
                                    exact: true,
                                    keywords: kw,
                                    content: item.content || ''
                                });
                            });
                        } 
                        // 2. 兼容普通的 JSON 数组格式
                        else if (Array.isArray(data)) {
                            data.forEach(item => {
                                entriesToImport.push({
                                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                    active: item.active !== false,
                                    title: item.title || '未命名',
                                    group: wbData.groups.includes(item.group) ? item.group : (currentWbGroupFilter === '默认分组' ? wbData.groups[0] : currentWbGroupFilter),
                                    position: item.position || 'before',
                                    constant: !!item.constant,
                                    exact: item.exact !== false,
                                    keywords: item.keywords || '',
                                    content: item.content || ''
                                });
                            });
                        }
                        // 3. 兼容单个 JSON 对象
                        else {
                            entriesToImport.push({
                                id: Date.now().toString(),
                                active: data.active !== false,
                                title: data.title || fileName,
                                group: wbData.groups.includes(data.group) ? data.group : (currentWbGroupFilter === '默认分组' ? wbData.groups[0] : currentWbGroupFilter),
                                position: data.position || 'before',
                                constant: !!data.constant,
                                exact: data.exact !== false,
                                keywords: data.keywords || '',
                                content: data.content || ''
                            });
                        }

                        if (entriesToImport.length > 0) {
                            wbData.entries.push(...entriesToImport);
                            alert(`成功导入 ${entriesToImport.length} 个词条！`);
                        } else {
                            alert('未在 JSON 中找到有效的词条数据。');
                        }

                    } catch (err) {
                        console.error(err);
                        alert('JSON 解析失败，将作为普通文本导入');
                        importAsText(fileName, content);
                    }
                } else {
                    importAsText(fileName, content);
                }
                
                // 强制同步写入数据库
                ChatDB.setItem('worldbook_data', JSON.stringify(wbData));
                renderWbList();
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function importAsText(title, content) {
    wbData.entries.push({
        id: Date.now().toString(),
        active: true,
        title: title,
        group: currentWbGroupFilter === '默认分组' ? wbData.groups[0] : currentWbGroupFilter,
        position: 'before',
        constant: false,
        exact: true,
        keywords: title, // 默认关键词为文件名
        content: content.trim()
    });
    alert(`成功导入文本词条：${title}`);
}

// 切换词条激活状态
function toggleWbEntryActive(id) {
    const entry = wbData.entries.find(e => e.id === id);
    if (entry) {
        entry.active = !entry.active;
        saveWbData();
        renderWbList(); // 修复：添加重新渲染，实现点击立刻刷新UI
    }
}

// 渲染分组下拉框和弹窗列表
function renderWbGroups() {
    // 1. 渲染编辑页的标题下拉弹窗
    const editGroupListEl = document.getElementById('wbEditGroupList');
    editGroupListEl.innerHTML = '';
    wbData.groups.forEach(g => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `<span class="preset-item-name">${g}</span>`;
        item.onclick = () => {
            document.getElementById('wb-edit-header-group').innerText = g;
            document.getElementById('wbEditGroupPopup').classList.remove('show');
        };
        editGroupListEl.appendChild(item);
    });

    // 2. 渲染气泡弹窗的分组列表 (列表页)
    const groupListEl = document.getElementById('wbGroupList');
    groupListEl.innerHTML = '';
    wbData.groups.forEach(g => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `
            <span class="preset-item-name">${g}</span>
            <div class="preset-delete-btn" onclick="deleteWbGroup('${g}', event)">-</div>
        `;
        // 点击分组过滤查看
        item.onclick = (e) => {
            if (!isWbGroupEditing) {
                currentWbGroupFilter = g;
                document.querySelector('#wbListPanel .header-title').innerText = g === '默认分组' ? 'Worldbook' : g;
                wbGroupPopup.classList.remove('show');
                renderWbList(); // 重新渲染列表
            }
        };
        groupListEl.appendChild(item);
    });
}

// --- Worldbook 编辑与保存逻辑 ---
function createNewWbEntry() {
    document.getElementById('wb-edit-id').value = '';
    document.getElementById('wb-edit-title').value = '';
    document.getElementById('wb-edit-keywords').value = '';
    document.getElementById('wb-edit-content').value = '';
    document.getElementById('wb-edit-constant').checked = false;
    document.getElementById('wb-edit-exact').checked = true;
    
    // 恢复默认显示文本
    document.getElementById('wb-edit-header-group').innerText = currentWbGroupFilter || wbData.groups[0];
    document.getElementById('wb-edit-position-text').innerText = '字符前';
    document.getElementById('wb-edit-position').value = 'before';
    
    openWbEditPanel();
}

function editWbEntry(id) {
    const entry = wbData.entries.find(e => e.id === id);
    if (!entry) return;
    
    document.getElementById('wb-edit-id').value = entry.id;
    document.getElementById('wb-edit-title').value = entry.title;
    document.getElementById('wb-edit-keywords').value = entry.keywords;
    document.getElementById('wb-edit-content').value = entry.content;
    document.getElementById('wb-edit-constant').checked = entry.constant;
    document.getElementById('wb-edit-exact').checked = entry.exact;
    document.getElementById('wb-edit-position').value = entry.position;
    
    // 更新显示的文本
    document.getElementById('wb-edit-header-group').innerText = entry.group;
    const posSelect = document.getElementById('wb-edit-position');
    document.getElementById('wb-edit-position-text').innerText = posSelect.options[posSelect.selectedIndex].text.split(' ')[0];
    
    openWbEditPanel();
}

function saveWbEntry() {
    const id = document.getElementById('wb-edit-id').value || Date.now().toString();
    const title = document.getElementById('wb-edit-title').value.trim();
    
    if (!title) return alert('请输入世界书名称！');

    const newEntry = {
        id: id,
        active: true,
        title: title,
        group: document.getElementById('wb-edit-header-group').innerText || wbData.groups[0],
        position: document.getElementById('wb-edit-position').value,
        constant: document.getElementById('wb-edit-constant').checked,
        exact: document.getElementById('wb-edit-exact').checked,
        keywords: document.getElementById('wb-edit-keywords').value.trim(),
        content: document.getElementById('wb-edit-content').value.trim()
    };

    const existingIndex = wbData.entries.findIndex(e => e.id === id);
    if (existingIndex >= 0) {
        // 保留原有的 active 状态
        newEntry.active = wbData.entries[existingIndex].active;
        wbData.entries[existingIndex] = newEntry;
    } else {
        wbData.entries.push(newEntry);
    }

    saveWbData();
    renderWbList();
    closeWbEditPanel();
}

function deleteWbEntry() {
    const id = document.getElementById('wb-edit-id').value;
    if (!id) return closeWbEditPanel(); // 如果是新建状态直接关闭
    
    if (confirm('确定要删除这个世界书词条吗？')) {
        wbData.entries = wbData.entries.filter(e => e.id !== id);
        saveWbData();
        renderWbList();
        closeWbEditPanel();
    }
}

// --- Worldbook 分组弹窗逻辑 ---
const wbGroupPopup = document.getElementById('wbGroupPopup');
let isWbGroupEditing = false;

function toggleWbGroupPopup() {
    wbGroupPopup.classList.toggle('show');
    if (wbGroupPopup.classList.contains('show')) {
        isWbGroupEditing = false;
        wbGroupPopup.classList.remove('is-editing');
        document.getElementById('wbGroupEditBtn').innerText = 'Edit';
        renderWbGroups();
    }
}

function toggleWbGroupEditMode() {
    isWbGroupEditing = !isWbGroupEditing;
    const editBtn = document.getElementById('wbGroupEditBtn');
    if (isWbGroupEditing) {
        wbGroupPopup.classList.add('is-editing');
        editBtn.innerText = 'Done';
    } else {
        wbGroupPopup.classList.remove('is-editing');
        editBtn.innerText = 'Edit';
    }
}

function promptAddWbGroup() {
    const name = prompt("请输入新分组名称：");
    if (name && name.trim() !== "") {
        if (wbData.groups.includes(name.trim())) return alert('分组已存在！');
        wbData.groups.push(name.trim());
        saveWbData();
        renderWbGroups();
    }
}

function deleteWbGroup(groupName, e) {
    e.stopPropagation();
    if (groupName === '默认分组') return alert('默认分组不可删除！');
    if (confirm(`确定删除分组 [${groupName}] 吗？该分组下的词条将被移至默认分组。`)) {
        wbData.groups = wbData.groups.filter(g => g !== groupName);
        wbData.entries.forEach(entry => {
            if (entry.group === groupName) entry.group = '默认分组';
        });
        saveWbData();
        renderWbGroups();
        renderWbList();
    }
}

function toggleWbCreatePopup() {
    document.getElementById('wbCreatePopup').classList.toggle('show');
    document.getElementById('wbGroupPopup').classList.remove('show'); // 互斥隐藏
}

// 点击空白处关闭 Worldbook 分组弹窗和 Create 弹窗
document.addEventListener('click', (e) => {
    const wbTitle = document.querySelector('#wbListPanel .header-title');
    const wbCreateBtn = document.querySelector('#wbListPanel .header-close[onclick="toggleWbCreatePopup()"]');
    
    if (wbGroupPopup && wbGroupPopup.classList.contains('show') && !wbGroupPopup.contains(e.target) && e.target !== wbTitle) {
        wbGroupPopup.classList.remove('show');
    }
    
    const wbCreatePopup = document.getElementById('wbCreatePopup');
    if (wbCreatePopup && wbCreatePopup.classList.contains('show') && !wbCreatePopup.contains(e.target) && e.target !== wbCreateBtn) {
        wbCreatePopup.classList.remove('show');
    }
});

// 页面加载时初始化 Worldbook 数据 (等待数据库就绪)
window.addEventListener('ChatDBReady', () => {
    // 重新读取最新数据，防止被初始化的空数据覆盖
    wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || {
        groups: ['默认分组'],
        entries: []
    };
    renderWbGroups();
    renderWbList();
});

// 编辑页标题分组弹窗逻辑
const wbEditGroupPopup = document.getElementById('wbEditGroupPopup');
function toggleWbEditGroupPopup() {
    wbEditGroupPopup.classList.toggle('show');
}

// 点击空白处关闭弹窗 (补充)
document.addEventListener('click', (e) => {
    const editTitle = document.querySelector('#wbEditPanel .header-title');
    if (wbEditGroupPopup && wbEditGroupPopup.classList.contains('show') && !wbEditGroupPopup.contains(e.target) && !editTitle.contains(e.target)) {
        wbEditGroupPopup.classList.remove('show');
    }
});

// 点击 Done 保存数据并关闭
function saveAndCloseApiPanel() {
    const url = document.getElementById('apiUrl').value.trim();
    const key = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('apiModel').value;
    const temperature = document.getElementById('apiTemperature').value;
    
    ChatDB.setItem('current_api_config', JSON.stringify({ url, key, model, temperature }));
    closeApiPanel();
}

// ==========================================
// API 预设气泡弹窗与编辑逻辑
// ==========================================
const apiPresetPopup = document.getElementById('apiPresetPopup');
let isApiPresetEditing = false;

function toggleApiPresetPopup() {
    apiPresetPopup.classList.toggle('show');
    if (apiPresetPopup.classList.contains('show')) {
        isApiPresetEditing = false;
        apiPresetPopup.classList.remove('is-editing');
        document.getElementById('apiPresetEditBtn').innerText = 'Edit';
        renderApiPresets();
    }
}

function toggleApiPresetEditMode() {
    isApiPresetEditing = !isApiPresetEditing;
    const editBtn = document.getElementById('apiPresetEditBtn');
    if (isApiPresetEditing) {
        apiPresetPopup.classList.add('is-editing');
        editBtn.innerText = 'Done';
    } else {
        apiPresetPopup.classList.remove('is-editing');
        editBtn.innerText = 'Edit';
    }
}

// 点击空白处关闭 API 预设弹窗
document.addEventListener('click', (e) => {
    const apiTitle = document.querySelector('#apiPanel .header-title');
    if (apiPresetPopup && apiPresetPopup.classList.contains('show') && !apiPresetPopup.contains(e.target) && e.target !== apiTitle) {
        apiPresetPopup.classList.remove('show');
    }
});

// --- API 模型拉取与搜索逻辑 ---
window.fetchedModels = []; // 全局变量，用于保存拉取到的所有模型

// 监听搜索框输入事件
document.getElementById('modelSearch').addEventListener('input', (e) => {
    renderModelSelect(e.target.value);
});

// 渲染模型下拉列表
function renderModelSelect(filterText = '') {
    const select = document.getElementById('apiModel');
    select.innerHTML = '';
    
    // 根据搜索框内容过滤模型
    const filtered = window.fetchedModels.filter(m => 
        m.id.toLowerCase().includes(filterText.toLowerCase())
    );
    
    if (filtered.length === 0) {
        select.innerHTML = '<option value="">未找到匹配的模型</option>';
        return;
    }
    
    filtered.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id; 
        opt.textContent = m.id;
        select.appendChild(opt);
    });
}

// 拉取模型逻辑 (加入自动跨域代理双保险)
async function fetchModels() {
    const urlInput = document.getElementById('apiUrl').value.trim().replace(/\/$/, '');
    const key = document.getElementById('apiKey').value.trim();
    const select = document.getElementById('apiModel');
    
    if (!urlInput || !key) return alert('请先填写 API URL 和 Key');

    select.innerHTML = '<option>拉取中...</option>';
    const targetUrl = `${urlInput}/models`;

    try {
        let res;
        try {
            // 1. 先尝试直接拉取
            res = await fetch(targetUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}` }
            });
        } catch (directErr) {
            console.warn("直连拉取失败，可能遇到跨域限制，正在启用 CORS 代理...", directErr);
            // 2. 如果直连失败（通常是跨域拦截），自动使用公共 CORS 代理节点兜底
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            res = await fetch(proxyUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}` }
            });
        }
        
        if (!res.ok) throw new Error(`HTTP 状态码错误: ${res.status}`);
        const data = await res.json();
        
        if (data.data && Array.isArray(data.data)) {
            window.fetchedModels = data.data.map(m => ({ id: m.id })); 
            
            const searchInput = document.getElementById('modelSearch');
            if (searchInput) searchInput.value = '';
            
            renderModelSelect(); 
            alert(`成功拉取 ${data.data.length} 个模型！`);
        } else {
            window.fetchedModels = [];
            select.innerHTML = '<option>未找到模型</option>';
            alert("拉取失败：接口返回的数据格式不正确");
        }
    } catch (e) {
        window.fetchedModels = [];
        select.innerHTML = '<option>拉取失败</option>';
        alert('拉取失败！请检查地址、Key是否正确。\n详细错误: ' + e.message);
    }
}

// API 预设逻辑 (使用 localStorage 存储)
function promptSaveApiPreset() {
    const name = prompt("请输入预设名称：");
    if (!name || name.trim() === "") return;
    
    const url = document.getElementById('apiUrl').value.trim();
    const key = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('apiModel').value;
    const temperature = document.getElementById('apiTemperature').value;

    let presets = JSON.parse(ChatDB.getItem('api_presets') || '[]');
    presets.push({ id: Date.now(), name: name.trim(), url, key, model, temperature });
    ChatDB.setItem('api_presets', JSON.stringify(presets));
    
    renderApiPresets();
}

function renderApiPresets() {
    const list = document.getElementById('apiPresetList');
    let presets = JSON.parse(ChatDB.getItem('api_presets') || '[]');
    list.innerHTML = '';
    
    if (presets.length === 0) {
        list.innerHTML = '<div style="padding: 15px; text-align: center; color: #aaa; font-size: 12px;">暂无预设</div>';
        return;
    }

    presets.forEach(p => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'preset-item-name';
        nameSpan.innerText = p.name;
        
        // 赋予正确的类名，受 CSS 控制：只有在 Edit 模式下才显示
        const delBtn = document.createElement('div');
        delBtn.className = 'preset-delete-btn'; 
        delBtn.innerText = '-';
        
        delBtn.onclick = (e) => {
            e.stopPropagation();
            presets = presets.filter(preset => preset.id !== p.id);
            ChatDB.setItem('api_presets', JSON.stringify(presets));
            renderApiPresets();
        };

        item.onclick = () => {
            // 只有在非编辑模式下，点击才会应用预设
            if (!isApiPresetEditing) {
                document.getElementById('apiUrl').value = p.url || '';
                document.getElementById('apiKey').value = p.key || '';
                if (p.model) {
                    document.getElementById('apiModel').innerHTML = `<option value="${p.model}">${p.model}</option>`;
                }
                if (p.temperature !== undefined) {
                    document.getElementById('apiTemperature').value = p.temperature;
                    document.getElementById('apiTempValue').innerText = p.temperature;
                }
                apiPresetPopup.classList.remove('show');
            }
        };

        item.appendChild(nameSpan);
        item.appendChild(delBtn);
        list.appendChild(item);
    });
}


// --- 通用图片上传处理 ---
function handleImageUpload(element, callback) {
    element.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    callback(event.target.result, element);
                    // 修复：图片上传后立即触发自动保存，防止刷新丢失
                    if (typeof triggerAutoSave === 'function') triggerAutoSave();
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    });
}

// 桌面小组件图片上传
document.querySelectorAll('.uploadable-img').forEach(el => {
    handleImageUpload(el, (imgUrl, targetEl) => {
        targetEl.style.backgroundImage = `url(${imgUrl})`;
        targetEl.classList.add('has-image');
    });
});

// --- 壁纸库逻辑 ---
const galleryGrid = document.getElementById('wallpaperGrid');
const editGalleryBtn = document.getElementById('editGalleryBtn');
const galleryBox = document.getElementById('galleryBox');
const galleryEmptyText = document.getElementById('galleryEmptyText');
let isGalleryEditing = false;

// 新增：检查壁纸库是否为空，控制提示文字的显示
function updateGalleryEmptyState() {
    if (galleryGrid.children.length === 0) {
        galleryEmptyText.style.display = 'block';
    } else {
        galleryEmptyText.style.display = 'none';
    }
}

function setDesktopWallpaper(url) {
    document.getElementById('iphone-container').style.backgroundImage = `url(${url})`;
    if (typeof triggerAutoSave === 'function') triggerAutoSave(); // 新增：触发自动保存
}

function addWallpaperToGallery(url, isRestore = false) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.style.backgroundImage = `url(${url})`;

    const delBtn = document.createElement('div');
    delBtn.className = 'delete-badge';
    delBtn.innerHTML = '×';

    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
        updateGalleryEmptyState(); // 删除后检查状态
        if (typeof triggerAutoSave === 'function') triggerAutoSave(); // 新增：删除壁纸后触发自动保存
    });

    item.addEventListener('click', () => {
        if (!isGalleryEditing) {
            setDesktopWallpaper(url);
        }
    });

    item.appendChild(delBtn);
    galleryGrid.appendChild(item); // 改为直接追加到末尾
    
    if (!isRestore) {
        setDesktopWallpaper(url); // 如果不是恢复数据，才自动设置为桌面壁纸
    }
    updateGalleryEmptyState(); // 添加后检查状态
}

// 页面加载时初始化检查空状态 (等待数据库就绪)
window.addEventListener('ChatDBReady', () => {
    updateGalleryEmptyState();
});

// 头像上传按钮依然可以添加壁纸
handleImageUpload(document.getElementById('profileAvatarBtn'), (url) => addWallpaperToGallery(url));

editGalleryBtn.addEventListener('click', () => {
    isGalleryEditing = !isGalleryEditing;
    if (isGalleryEditing) {
        galleryBox.classList.add('is-editing');
        editGalleryBtn.innerText = 'Done';
    } else {
        galleryBox.classList.remove('is-editing');
        editGalleryBtn.innerText = 'Edit';
    }
});

// --- 更换 APP 图标 ---
document.querySelectorAll('.app-icon-upload').forEach(el => {
    handleImageUpload(el, (imgUrl, targetEl) => {
        targetEl.style.backgroundImage = `url(${imgUrl})`;
        targetEl.classList.add('has-image');
        const targetAppId = targetEl.getAttribute('data-target');
        const appIconEl = document.getElementById(targetAppId);
        appIconEl.classList.add('is-custom'); // 添加自定义类名，触发透明底和隐藏SVG
        appIconEl.style.backgroundImage = `url(${imgUrl})`;
    });
});

// --- 实时修改 APP 名称 ---
document.querySelectorAll('.app-name-input').forEach(input => {
    input.addEventListener('input', (e) => {
        const targetAppId = e.target.getAttribute('data-target');
        document.getElementById(targetAppId).innerText = e.target.value;
    });
});

// --- 字体处理逻辑 ---
window.currentGlobalFontUrl = ''; // 新增：用于记录当前应用的字体URL
window.currentGlobalFontSize = '14'; // 新增：记录当前字体大小

function injectFont(url) {
    window.currentGlobalFontUrl = url; // 记录下来供预设保存使用
    const fontName = 'CustomFont_' + Date.now();
    const style = document.createElement('style');
    style.innerHTML = `
        @font-face {
            font-family: '${fontName}';
            src: url('${url}');
        }
        * {
            font-family: '${fontName}', -apple-system, BlinkMacSystemFont, sans-serif !important;
        }
    `;
    document.head.appendChild(style);
    if (typeof triggerAutoSave === 'function') triggerAutoSave(); // 新增：触发自动保存
}

// 新增：动态生成 CSS 覆盖核心文本类的字号，实现全局调节
function applyFontSize(size) {
    window.currentGlobalFontSize = size;
    const diff = parseInt(size) - 14; // 以 14px 为基准计算差值
    let styleTag = document.getElementById('customFontSizeStyle');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'customFontSizeStyle';
        document.head.appendChild(styleTag);
    }
    if (diff === 0) {
        styleTag.innerHTML = '';
        return;
    }
    // 针对核心阅读类，增加 diff 的像素
    styleTag.innerHTML = `
        .cr-bubble { font-size: ${14 + diff}px !important; }
        .wb-file-content { font-size: ${12 + diff}px !important; line-height: ${24 + diff}px !important; background-image: repeating-linear-gradient(transparent, transparent ${23+diff}px, rgba(0,0,0,0.06) ${23+diff}px, rgba(0,0,0,0.06) ${24+diff}px) !important; }
        .wb-file-title { font-size: ${13 + diff}px !important; }
        .wechat-msg { font-size: ${13 + diff}px !important; }
        .wechat-name { font-size: ${16 + diff}px !important; }
        .p-input-group input, .p-input-group textarea { font-size: ${12 + diff}px !important; }
        .visible-textarea { font-size: ${13 + diff}px !important; }
        .chat-input-row input { font-size: ${15 + diff}px !important; }
        .me-id-sign { font-size: ${12 + diff}px !important; }
        .sc-text { font-size: ${13 + diff}px !important; }
        .char-lib-name { font-size: ${14 + diff}px !important; }
        .char-lib-desc { font-size: ${11 + diff}px !important; }
        .id-text { font-size: ${12 + diff}px !important; }
        .cr-input-container input { font-size: ${15 + diff}px !important; }
        .app-name { font-size: ${12 + diff}px !important; }
        .music-title { font-size: ${16 + diff}px !important; }
        .music-sub { font-size: ${12 + diff}px !important; }
        .widget-search { font-size: ${14 + diff}px !important; }
    `;
}

// 监听字体大小滑动条
const fontSizeSlider = document.getElementById('globalFontSizeSlider');
if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', (e) => {
        applyFontSize(e.target.value);
        triggerAutoSave();
    });
}

document.getElementById('localFontBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ttf,.otf,.woff,.woff2';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            injectFont(url);
            document.getElementById('localFontText').innerText = "已应用: " + file.name;
        }
    };
    input.click();
});

const urlInput = document.getElementById('fontUrlInput');
urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        if (url) {
            injectFont(url);
            urlInput.blur();
        }
    }
});
urlInput.addEventListener('change', () => {
    const url = urlInput.value.trim();
    if (url) injectFont(url);
});

// 阻止 contenteditable 回车换行
document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !this.classList.contains('music-sub')) {
            e.preventDefault();
            this.blur();
        }
    });
});

// ==========================================
// IndexedDB 预设与全局状态管理系统
// ==========================================
const DB_NAME = 'ThemeStudioDB';
const PRESET_STORE = 'presets';
const STATE_STORE = 'app_state'; // 新增：用于存储当前所有状态
let dbInstance = null;

// 初始化数据库 (升级版本到 2)
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(PRESET_STORE)) {
                db.createObjectStore(PRESET_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STATE_STORE)) {
                db.createObjectStore(STATE_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- 预设数据库操作 ---
function getAllPresets() {
    return new Promise((resolve) => {
        if (!dbInstance) return resolve([]);
        const transaction = dbInstance.transaction([PRESET_STORE], 'readonly');
        const store = transaction.objectStore(PRESET_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
    });
}
function savePresetToDB(preset) {
    return new Promise((resolve) => {
        const transaction = dbInstance.transaction([PRESET_STORE], 'readwrite');
        const store = transaction.objectStore(PRESET_STORE);
        store.put(preset);
        transaction.oncomplete = () => resolve();
    });
}
function deletePresetFromDB(id) {
    return new Promise((resolve) => {
        const transaction = dbInstance.transaction([PRESET_STORE], 'readwrite');
        const store = transaction.objectStore(PRESET_STORE);
        store.delete(id);
        transaction.oncomplete = () => resolve();
    });
}

// --- 全局状态数据库操作 ---
function saveGlobalStateToDB(state) {
    if (!dbInstance) return;
    const transaction = dbInstance.transaction([STATE_STORE], 'readwrite');
    const store = transaction.objectStore(STATE_STORE);
    store.put({ id: 'current', data: state });
}
function getGlobalStateFromDB() {
    return new Promise((resolve) => {
        if (!dbInstance) return resolve(null);
        const transaction = dbInstance.transaction([STATE_STORE], 'readonly');
        const store = transaction.objectStore(STATE_STORE);
        const request = store.get('current');
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
    });
}
function clearGlobalStateFromDB() {
    return new Promise((resolve) => {
        const transaction = dbInstance.transaction([STATE_STORE], 'readwrite');
        const store = transaction.objectStore(STATE_STORE);
        store.delete('current');
        transaction.oncomplete = () => resolve();
    });
}

// --- 抓取当前页面所有状态 ---
function captureFullState() {
    const state = {
        fontUrl: window.currentGlobalFontUrl || '',
        fontSize: window.currentGlobalFontSize || '14', // 新增：保存字体大小
        wallpaper: document.getElementById('iphone-container').style.backgroundImage,
        avatar: document.querySelector('.circle-avatar').style.backgroundImage,
        musicCover: document.querySelector('.music-cover').style.backgroundImage,
        gallery: Array.from(document.querySelectorAll('.gallery-item-widget')).map(el => el.style.backgroundImage),
        wallpaperGallery: Array.from(document.querySelectorAll('#wallpaperGrid .gallery-item')).map(el => el.style.backgroundImage), // 新增：保存壁纸库列表
        apps: {},
        texts: Array.from(document.querySelectorAll('[contenteditable="true"]')).map(el => el.innerText)
    };
    for (let i = 1; i <= 7; i++) {
        let appId = i === 5 ? 'app-dock1' : (i === 6 ? 'app-dock-music' : (i === 7 ? 'app-mall' : `app${i}`));
        state.apps[appId] = {
            icon: document.getElementById(`icon-${appId}`).style.backgroundImage,
            name: document.getElementById(`name-${appId}`).innerText
        };
    }

    return state;
}

// --- 恢复页面状态 ---
function applyFullState(state) {
    if (!state) return;
    if (state.fontUrl) injectFont(state.fontUrl);
    
    // 新增：恢复字体大小
    if (state.fontSize) {
        applyFontSize(state.fontSize);
        const slider = document.getElementById('globalFontSizeSlider');
        if (slider) slider.value = state.fontSize;
    } else {
        applyFontSize('14');
        const slider = document.getElementById('globalFontSizeSlider');
        if (slider) slider.value = '14';
    }

    if (state.wallpaper && state.wallpaper !== 'none') setDesktopWallpaper(state.wallpaper.replace(/^url\(["']?/, '').replace(/["']?\)$/, ''));
    if (state.avatar && state.avatar !== 'none') document.querySelector('.circle-avatar').style.backgroundImage = state.avatar;
    
    // 新增：恢复壁纸库列表
    if (state.wallpaperGallery && Array.isArray(state.wallpaperGallery)) {
        const grid = document.getElementById('wallpaperGrid');
        if (grid) grid.innerHTML = ''; // 清空当前列表防止重复
        state.wallpaperGallery.forEach(bg => {
            if (bg && bg !== 'none' && bg !== '') {
                const cleanUrl = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
                addWallpaperToGallery(cleanUrl, true); // true 表示是恢复数据，不触发桌面壁纸替换
            }
        });
    }
    if (state.musicCover && state.musicCover !== 'none' && state.musicCover !== '') {
        const musicCoverEl = document.querySelector('.music-cover');
        if (musicCoverEl) {
            musicCoverEl.style.backgroundImage = state.musicCover;
            musicCoverEl.classList.add('has-image');
        }
    } else {
        const musicCoverEl = document.querySelector('.music-cover');
        if (musicCoverEl) {
            musicCoverEl.style.backgroundImage = '';
            musicCoverEl.classList.remove('has-image');
        }
    }
    
    const galleryEls = document.querySelectorAll('.gallery-item-widget');
    if (state.gallery) {
        state.gallery.forEach((bg, idx) => {
            if (bg && bg !== 'none' && bg !== '' && galleryEls[idx]) {
                galleryEls[idx].style.backgroundImage = bg;
                galleryEls[idx].classList.add('has-image');
            } else if (galleryEls[idx]) {
                galleryEls[idx].style.backgroundImage = '';
                galleryEls[idx].classList.remove('has-image');
            }
        });
    }
    
    for (let i = 1; i <= 7; i++) {
        let appId = i === 5 ? 'app-dock1' : (i === 6 ? 'app-dock-music' : (i === 7 ? 'app-mall' : `app${i}`));
        const appData = state.apps[appId];
        if (appData) {
            const appIconEl = document.getElementById(`icon-${appId}`);
            const uploadEl = document.querySelector(`.app-icon-upload[data-target="icon-${appId}"]`);
            if (appData.icon && appData.icon !== 'none' && appData.icon !== '') {
                if (appIconEl) {
                    appIconEl.classList.add('is-custom'); // 恢复状态时也添加自定义类名
                    appIconEl.style.backgroundImage = appData.icon;
                }
                if (uploadEl) {
                    uploadEl.style.backgroundImage = appData.icon;
                    uploadEl.classList.add('has-image');
                }
            } else {
                if (appIconEl) {
                    appIconEl.classList.remove('is-custom');
                    appIconEl.style.backgroundImage = '';
                }
                if (uploadEl) {
                    uploadEl.style.backgroundImage = '';
                    uploadEl.classList.remove('has-image');
                }
            }
            if (appData.name) {
                const nameEl = document.getElementById(`name-${appId}`);
                if (nameEl) nameEl.innerText = appData.name;
                const nameInput = document.querySelector(`.app-name-input[data-target="name-${appId}"]`);
                if (nameInput) nameInput.value = appData.name;
            }
        }
    }

    const textEls = document.querySelectorAll('[contenteditable="true"]');
    if (state.texts) {
        state.texts.forEach((txt, idx) => {
            if (txt && textEls[idx]) textEls[idx].innerText = txt;
        });
    }
}

// 防抖保存，避免频繁写入
let saveTimeout;
function triggerAutoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveGlobalStateToDB(captureFullState());
    }, 500);
}

// 监听文本输入触发保存
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('app-name-input') || e.target.getAttribute('contenteditable') === 'true') {
        triggerAutoSave();
    }
});

// --- 恢复默认功能 ---
async function confirmResetDefault() {
    if (confirm('确定要恢复默认设置吗？这将仅清除当前的自定义APP图标、名称和字体。')) {
        // 1. 恢复字体为默认
        window.currentGlobalFontUrl = '';
        document.getElementById('fontUrlInput').value = '';
        document.getElementById('localFontText').innerText = '上传本地字体';
        // 移除所有动态注入的自定义字体 style 标签
        document.querySelectorAll('style').forEach(style => {
            if (style.innerHTML.includes('CustomFont_')) {
                style.remove();
            }
        });

        // 2. 恢复 APP 图标和名称为默认
        const defaultApps = [
            { id: 'app1', name: 'theme' },
            { id: 'app2', name: 'settings' },
            { id: 'app3', name: 'worldbook' },
            { id: 'app4', name: 'chat' },
            { id: 'app-mall', name: 'Shopping' },
            { id: 'app-dock1', name: 'Chars' },
            { id: 'app-dock-music', name: 'Music' }
        ];

        defaultApps.forEach(app => {
            // 恢复桌面图标
            const appIconEl = document.getElementById(`icon-${app.id}`);
            if (appIconEl) {
                appIconEl.classList.remove('is-custom');
                appIconEl.style.backgroundImage = '';
            }
            // 恢复桌面名称
            const appNameEl = document.getElementById(`name-${app.id}`);
            if (appNameEl) {
                appNameEl.innerText = app.name;
            }
            // 恢复面板中的上传预览图
            const uploadEl = document.querySelector(`.app-icon-upload[data-target="icon-${app.id}"]`);
            if (uploadEl) {
                uploadEl.style.backgroundImage = '';
                uploadEl.classList.remove('has-image');
            }
            // 恢复面板中的输入框
            const nameInput = document.querySelector(`.app-name-input[data-target="name-${app.id}"]`);
            if (nameInput) {
                nameInput.value = app.name;
            }
        });

        // 3. 触发自动保存，将当前状态更新到数据库
        triggerAutoSave();
        alert('已恢复默认APP图标和字体！');
    }
}

// --- UI 交互逻辑 (预设弹窗) ---
const presetPopup = document.getElementById('presetPopup');
const presetListEl = document.getElementById('presetList');
const presetEditBtn = document.getElementById('presetEditBtn');
let isPresetEditing = false;

// 初始化：连接数据库 -> 读取全局状态 -> 渲染预设列表
initDB().then(async () => {
    const savedState = await getGlobalStateFromDB();
    if (savedState) applyFullState(savedState);
    renderPresetList();
});

function togglePresetPopup() {
    presetPopup.classList.toggle('show');
    if (presetPopup.classList.contains('show')) {
        isPresetEditing = false;
        presetPopup.classList.remove('is-editing');
        presetEditBtn.innerText = 'Edit';
        renderPresetList();
    }
}

document.addEventListener('click', (e) => {
    const title = document.querySelector('.header-title');
    if (presetPopup.classList.contains('show') && !presetPopup.contains(e.target) && e.target !== title) {
        presetPopup.classList.remove('show');
    }
});

async function renderPresetList() {
    const presets = await getAllPresets();
    presetListEl.innerHTML = '';
    if (presets.length === 0) {
        presetListEl.innerHTML = '<div style="padding: 15px; text-align: center; color: #aaa; font-size: 12px;">暂无预设</div>';
        return;
    }
    
    presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'preset-item-name';
        nameSpan.innerText = preset.name;
        
        const delBtn = document.createElement('div');
        delBtn.className = 'preset-delete-btn';
        delBtn.innerText = '-';
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            await deletePresetFromDB(preset.id);
            renderPresetList();
        };
        
        item.onclick = () => {
            if (!isPresetEditing) {
                applyFullState(preset.state); // 应用预设状态
                triggerAutoSave(); // 应用预设后自动保存为当前状态
                presetPopup.classList.remove('show');
            }
        };
        
        item.appendChild(nameSpan);
        item.appendChild(delBtn);
        presetListEl.appendChild(item);
    });
}

function togglePresetEditMode() {
    isPresetEditing = !isPresetEditing;
    if (isPresetEditing) {
        presetPopup.classList.add('is-editing');
        presetEditBtn.innerText = 'Done';
    } else {
        presetPopup.classList.remove('is-editing');
        presetEditBtn.innerText = 'Edit';
    }
}

// --- 命名弹窗逻辑 ---
const modalOverlay = document.getElementById('presetModalOverlay');
const nameInput = document.getElementById('presetNameInput');

function showSavePresetModal() {
    presetPopup.classList.remove('show');
    nameInput.value = '';
    modalOverlay.classList.add('show');
    setTimeout(() => nameInput.focus(), 100);
}

function hideSavePresetModal() {
    modalOverlay.classList.remove('show');
}

async function confirmSavePreset() {
    const name = nameInput.value.trim();
    if (!name) {
        alert('请输入预设名称');
        return;
    }
    const currentState = captureFullState();
    const newPreset = {
        id: Date.now().toString(),
        name: name,
        state: currentState // 将整个状态打包存入预设
    };
    await savePresetToDB(newPreset);
    hideSavePresetModal();
    renderPresetList(); 
}
// ==========================================
// 状态栏时间与电量实时更新
// ==========================================
function updateStatusBarTime() {
    const timeEl = document.querySelector('.status-bar .time');
    if (!timeEl) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes}`;
}

function initBattery() {
    const batteryLevelEl = document.querySelector('.battery-level');
    const batteryNumEl = document.getElementById('battery-num');
    if (!batteryLevelEl) return;
    
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function(battery) {
            function updateBattery() {
                const level = Math.round(battery.level * 100);
                batteryLevelEl.style.width = level + '%';
                if (batteryNumEl) batteryNumEl.textContent = level + '%';
                if (battery.charging) {
                    batteryLevelEl.style.backgroundColor = '#34c759'; 
                } else {
                    batteryLevelEl.style.backgroundColor = 'var(--text-main)';
                }
            }
            updateBattery();
            battery.addEventListener('levelchange', updateBattery);
            battery.addEventListener('chargingchange', updateBattery);
        });
    } else {
        batteryLevelEl.style.width = '80%';
        if (batteryNumEl) batteryNumEl.textContent = '80%';
    }
}

// 初始化并设置定时器
updateStatusBarTime();
setInterval(updateStatusBarTime, 5000); // 每5秒刷新一次时间
initBattery();

// ==========================================
// 角色皮套证件弹窗与编辑逻辑
// ==========================================
let currentViewingCharId = null; // 当前正在查看/编辑的角色ID

function openCharIdCardModal(char) {
    currentViewingCharId = char.id;
    
    // 格式化时间
    const date = new Date(parseInt(char.id));
    const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
    
    // 填充数据
    document.getElementById('modalCharPhoto').style.backgroundImage = char.avatarUrl ? `url('${char.avatarUrl}')` : '';
    document.getElementById('modalCharNetName').innerText = char.netName || char.name || '未设置';
    document.getElementById('modalCharAccount').innerText = char.account || '未设置';
    document.getElementById('modalCharPassword').innerText = char.password || '未设置';
    document.getElementById('modalCharDate').innerText = dateStr;
    
    // 显示弹窗并触发下落动画
    const overlay = document.getElementById('charIdCardModalOverlay');
    const caseEl = document.getElementById('charIdCardCase');
    overlay.classList.add('show');
    caseEl.style.animation = 'dropCase 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
}

function closeCharIdCardModal() {
    const caseEl = document.getElementById('charIdCardCase');
    caseEl.style.animation = 'liftCase 0.3s ease-in forwards';
    setTimeout(() => {
        document.getElementById('charIdCardModalOverlay').classList.remove('show');
    }, 300);
}
// ==========================================
// 桌面长按编辑模式与拖拽逻辑 (完美兼容移动端)
// ==========================================
let desktopPressTimer;
const homeScreen = document.getElementById('homeScreen');
const gridBg = document.getElementById('desktopGridBg');

// 动态生成 28 个网格单元格
for (let i = 0; i < 28; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    gridBg.appendChild(cell);
}

let dragEl = null;
let desktopDragStartX = 0, desktopDragStartY = 0;
let initialDesktopHTML = ''; // 用于记录编辑前的状态，方便取消时回滚

// 自动计算并填满桌面的空位
function fillDesktopPlaceholders() {
    const homeScreen = document.getElementById('homeScreen');
    if (!homeScreen) return;
    
    // 清除旧的占位符
    const existingPlaceholders = homeScreen.querySelectorAll('.app-placeholder');
    existingPlaceholders.forEach(p => p.remove());

    let usedSlots = 0;
    const items = homeScreen.querySelectorAll('.app-item, .widget-container');
    items.forEach(item => {
        if (item.closest('.dock-container')) return; // 排除底栏的 APP
        if (item.classList.contains('widget-container')) {
            usedSlots += 16; // 小组件占 4x4 = 16 格
        } else if (item.classList.contains('app-item')) {
            usedSlots += 1; // APP 占 1 格
        }
    });

    const totalSlots = 28; // 桌面总共 4x7 = 28 格
    const emptySlots = totalSlots - usedSlots;

    // 填充空位
    for (let i = 0; i < emptySlots; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'app-placeholder';
        placeholder.style.minHeight = '80px'; // 确保空位有高度，方便拖拽命中
        homeScreen.appendChild(placeholder);
    }
}

// 恢复保存的桌面布局顺序（完美恢复小组件和APP）
function restoreDesktopOrder() {
    const orderStr = ChatDB.getItem('desktop_order') || localStorage.getItem('desktop_order');
    if (!orderStr) return;
    const order = JSON.parse(orderStr);
    const homeScreen = document.getElementById('homeScreen');
    
    const elements = { app: {} };
    
    // 收集当前桌面上的 APP
    Array.from(homeScreen.children).forEach(child => {
        if (child.classList.contains('app-item')) {
            const iconEl = child.querySelector('.app-icon');
            if (iconEl) elements.app[iconEl.id] = child;
        }
    });

    // 清空桌面（保留 grid-bg）
    const gridBg = document.getElementById('desktopGridBg');
    homeScreen.innerHTML = '';
    if (gridBg) homeScreen.appendChild(gridBg);
    
    // 按照保存的顺序重新排列 DOM
    order.forEach(item => {
        if (item.type === 'widget') {
            const temp = document.createElement('div');
            
            // 如果是带有动态脚本的自定义小组件，重新注入原始 content 触发脚本
            if (item.isCustom && item.rawContent) {
                const transparentClass = item.isTransparent ? 'is-transparent-widget' : '';
                temp.innerHTML = `
                <div class="widget-container custom-desktop-widget ${transparentClass}" style="background: ${item.bgColor || ''}" data-raw-content="${item.rawContent}">
                    <div class="widget-delete-btn" onclick="deleteDesktopWidget(this)">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff3b30"></circle><line x1="8" y1="12" x2="16" y2="12" stroke="#fff" stroke-width="2"></line></svg>
                    </div>
                    ${decodeURIComponent(item.rawContent)}
                </div>`;
            } else {
                // 普通小组件直接恢复 HTML
                temp.innerHTML = item.html;
            }
            
            const widget = temp.firstElementChild;
            homeScreen.appendChild(widget);
            
            // 重新绑定小组件内的图片上传事件
            widget.querySelectorAll('.uploadable-img').forEach(el => {
                handleImageUpload(el, (imgUrl, targetEl) => {
                    targetEl.style.backgroundImage = `url(${imgUrl})`;
                    targetEl.classList.add('has-image');
                });
            });
        } else if (item.type === 'app' && elements.app[item.id]) {
            homeScreen.appendChild(elements.app[item.id]);
            delete elements.app[item.id]; // 标记已使用
        } else if (item.type === 'placeholder') {
            const placeholder = document.createElement('div');
            placeholder.className = 'app-placeholder';
            placeholder.style.minHeight = '80px';
            homeScreen.appendChild(placeholder);
        }
    });
    
    // 把没匹配上的新 APP 追加到最后
    Object.values(elements.app).forEach(el => homeScreen.appendChild(el));
}

// 拦截编辑模式下的点击事件，防止进入 APP
homeScreen.addEventListener('click', function(e) {
    if (homeScreen.classList.contains('is-desktop-editing')) {
        // 如果点击的不是删除按钮，则阻止默认跳转
        if (!e.target.closest('.widget-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
}, true); // 使用捕获阶段拦截

function bindDesktopLongPress() {
    fillDesktopPlaceholders(); // 每次绑定前确保空位被填满
    const items = homeScreen.querySelectorAll('.app-item, .widget-container');
    items.forEach(item => {
        item.removeEventListener('touchstart', handleTouchStart);
        item.removeEventListener('touchmove', handleTouchMove);
        item.removeEventListener('touchend', handleTouchEnd);
        item.removeEventListener('mousedown', handleTouchStart);
        
        item.addEventListener('touchstart', handleTouchStart, {passive: false});
        item.addEventListener('touchmove', handleTouchMove, {passive: false});
        item.addEventListener('touchend', handleTouchEnd);
        item.addEventListener('mousedown', handleTouchStart);
    });
    
    document.removeEventListener('mousemove', handleTouchMove);
    document.removeEventListener('mouseup', handleTouchEnd);
    document.addEventListener('mousemove', handleTouchMove, {passive: false});
    document.addEventListener('mouseup', handleTouchEnd);
}

function handleTouchStart(e) {
    const touch = e.touches ? e.touches[0] : e;
    desktopDragStartX = touch.clientX;
    desktopDragStartY = touch.clientY;

    if (!homeScreen.classList.contains('is-desktop-editing')) {
        desktopPressTimer = setTimeout(() => {
            enterDesktopEditMode();
        }, 800);
        return;
    }

    if (e.target.closest('.widget-delete-btn')) return;
    
    dragEl = e.target.closest('.app-item, .widget-container');
    if (!dragEl) return;

    dragEl.classList.add('dragging');
}

let currentDropTarget = null; // 记录当前悬停的目标

function handleTouchMove(e) {
    const touch = e.touches ? e.touches[0] : e;
    const currentX = touch.clientX;
    const currentY = touch.clientY;

    if (!homeScreen.classList.contains('is-desktop-editing')) {
        // 增加防抖：只有手指移动超过 10px 才取消长按，防止误触
        if (Math.abs(currentX - desktopDragStartX) > 10 || Math.abs(currentY - desktopDragStartY) > 10) {
            clearTimeout(desktopPressTimer);
        }
        return;
    }

    if (!dragEl) return;
    e.preventDefault();

    // 让元素跟随手指移动，并确保在最上层
    const deltaX = currentX - desktopDragStartX;
    const deltaY = currentY - desktopDragStartY;
    dragEl.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.05)`;
    dragEl.style.zIndex = '9999';

    dragEl.style.visibility = 'hidden';
    const targetEl = document.elementFromPoint(currentX, currentY);
    dragEl.style.visibility = 'visible';

    if (targetEl) {
        const dropTarget = targetEl.closest('.app-item, .widget-container, .app-placeholder');
        if (dropTarget && dropTarget !== dragEl && dropTarget.parentNode === homeScreen) {
            // 如果悬停到了新目标，添加高亮提示
            if (currentDropTarget !== dropTarget) {
                if (currentDropTarget) currentDropTarget.classList.remove('drag-over');
                currentDropTarget = dropTarget;
                currentDropTarget.classList.add('drag-over');
            }
        } else {
            // 移出目标区域时，清除高亮
            if (currentDropTarget) {
                currentDropTarget.classList.remove('drag-over');
                currentDropTarget = null;
            }
        }
    }
}

function handleTouchEnd(e) {
    clearTimeout(desktopPressTimer);
    if (dragEl) {
        // 松开手指时，如果停留在有效目标上，才执行位置交换
        if (currentDropTarget && currentDropTarget !== dragEl) {
            // 核心修复：精准互换两个 DOM 节点的位置，其他元素绝对不移动！
            const parentA = dragEl.parentNode;
            const siblingA = dragEl.nextSibling === currentDropTarget ? dragEl : dragEl.nextSibling;
            
            currentDropTarget.parentNode.insertBefore(dragEl, currentDropTarget);
            parentA.insertBefore(currentDropTarget, siblingA);
            
            currentDropTarget.classList.remove('drag-over');
            currentDropTarget = null;
        }

        dragEl.style.transform = ''; // 清除位移
        dragEl.style.zIndex = '';
        dragEl.classList.remove('dragging');
        dragEl = null;
    }
}

function enterDesktopEditMode() {
    const homeScreen = document.getElementById('homeScreen');
    // 记录进入编辑模式前的桌面 HTML，用于取消时回滚
    initialDesktopHTML = homeScreen.innerHTML;
    
    homeScreen.classList.add('is-desktop-editing');
    document.getElementById('desktopEditCapsule').classList.add('show');
}

function cancelDesktopEdit() {
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.classList.remove('is-desktop-editing');
    document.getElementById('desktopEditCapsule').classList.remove('show');
    
    // 如果点击了取消，恢复到进入编辑模式前的 HTML 状态
    if (initialDesktopHTML) {
        homeScreen.innerHTML = initialDesktopHTML;
        initialDesktopHTML = '';
        
        // 重新绑定长按拖拽事件
        bindDesktopLongPress();
        
        // 重新绑定小组件图片上传事件
        homeScreen.querySelectorAll('.uploadable-img').forEach(el => {
            handleImageUpload(el, (imgUrl, targetEl) => {
                targetEl.style.backgroundImage = `url(${imgUrl})`;
                targetEl.classList.add('has-image');
            });
        });
    }
}

function saveDesktopEdit() {
    initialDesktopHTML = ''; // 清除回滚记录，确认保存
    
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.classList.remove('is-desktop-editing');
    document.getElementById('desktopEditCapsule').classList.remove('show');
    
    // 记录当前 DOM 顺序并保存到本地
    const order = [];
    const items = homeScreen.querySelectorAll('.app-item, .widget-container, .app-placeholder');
    items.forEach(item => {
        if (item.classList.contains('widget-container')) {
            // 保存小组件的完整 HTML 及原始脚本内容，确保刷新后动态脚本能再次执行
            const rawContent = item.getAttribute('data-raw-content') || '';
            order.push({ 
                type: 'widget', 
                id: item.id || '', 
                html: item.outerHTML,
                rawContent: rawContent,
                isCustom: item.classList.contains('custom-desktop-widget'),
                isTransparent: item.classList.contains('is-transparent-widget'),
                bgColor: item.style.background
            });
        } else if (item.classList.contains('app-item')) {
            const iconEl = item.querySelector('.app-icon');
            order.push({ type: 'app', id: iconEl ? iconEl.id : '' });
        } else if (item.classList.contains('app-placeholder')) {
            order.push({ type: 'placeholder' });
        }
    });
    ChatDB.setItem('desktop_order', JSON.stringify(order));
    
    triggerAutoSave();
    alert('桌面布局已保存！');
}

function deleteDesktopWidget(btn) {
    if(confirm('确定要删除该小组件吗？')) {
        btn.closest('.widget-container').remove();
        fillDesktopPlaceholders(); // 删除后重新计算空位
        // 注意：这里不再自动保存，必须用户点击“保存”才会生效，点击“取消”会恢复
    }
}

// ==========================================
// 导入小组件弹窗逻辑 (支持预览、删除与持久化)
// ==========================================
let importedWidgets = JSON.parse(localStorage.getItem('imported_widgets') || '[]');

function renderImportedWidgets() {
    const content = document.getElementById('widgetModalContent');
    // 保留第一个默认组件，清除后面动态添加的
    while (content.children.length > 1) {
        content.removeChild(content.lastChild);
    }
    
    importedWidgets.forEach((data, index) => {
        const item = document.createElement('div');
        item.className = 'widget-preview-item';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        
        const isTransparent = data.bgColor === 'transparent';
        const transparentClass = isTransparent ? 'is-transparent-widget' : '';
        
        // 如果 JSON 中有 content，则使用 content；否则使用默认文本
        const innerContent = data.content ? data.content : `
        <div style="padding: 10px; font-size: 14px; font-weight: bold; color: #333; text-align: center;">
            ${data.name || '自定义小组件'}
        </div>`;
        
        item.innerHTML = `
            <div class="widget-preview-delete" onclick="deleteImportedWidget(${index}, event)">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff3b30"></circle><line x1="8" y1="12" x2="16" y2="12" stroke="#fff" stroke-width="2"></line></svg>
            </div>
            <div style="font-size: 14px; font-weight: bold; color: #333; width: 100%; text-align: center;" onclick="addImportedWidgetToDesktop(${index})">${data.name || '自定义小组件'}</div>
            <div onclick="addImportedWidgetToDesktop(${index})" style="width: 100%; height: 160px; position: relative; overflow: hidden; border-radius: 12px; background: #f4f4f5; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                <div style="transform: scale(0.45); transform-origin: center; pointer-events: none; width: 350px;">
                    <div class="widget-container custom-desktop-widget ${transparentClass}" style="margin: 0; box-shadow: 0 10px 30px rgba(0,0,0,0.1); background: ${data.bgColor || ''}">
                        ${innerContent}
                    </div>
                </div>
            </div>
        `;
        content.appendChild(item);
    });
}

function openWidgetModal() {
    renderImportedWidgets();
    document.getElementById('widgetModalOverlay').classList.add('show');
}

function closeWidgetModal() {
    document.getElementById('widgetModalOverlay').classList.remove('show');
}

function importWidgetJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            data.name = data.name || file.name;
            importedWidgets.push(data);
            localStorage.setItem('imported_widgets', JSON.stringify(importedWidgets));
            renderImportedWidgets();
            alert('小组件导入成功！');
        } catch (err) {
            alert('解析JSON失败，请确保文件格式正确。');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // 清空 input 允许重复导入同名文件
}

function deleteImportedWidget(index, e) {
    e.stopPropagation(); // 阻止触发添加事件
    if (confirm('确定要从列表中删除这个导入的小组件吗？')) {
        importedWidgets.splice(index, 1);
        localStorage.setItem('imported_widgets', JSON.stringify(importedWidgets));
        renderImportedWidgets();
    }
}

function addImportedWidgetToDesktop(index) {
    const data = importedWidgets[index];
    if (!data) return;
    
    const isTransparent = data.bgColor === 'transparent';
    const transparentClass = isTransparent ? 'is-transparent-widget' : '';
    
    // 如果 JSON 中有 content，则使用 content；否则使用默认文本
    const innerContent = data.content ? data.content : `
    <div style="padding: 10px; font-size: 14px; font-weight: bold; color: #333; text-align: center;">
        ${data.name || '自定义小组件'}
    </div>`;
    
    // 将原始代码进行编码并存入属性中，防止刷新时脚本丢失
    const rawAttr = data.content ? `data-raw-content="${encodeURIComponent(data.content)}"` : '';
    
    const widgetHTML = `
    <div class="widget-container custom-desktop-widget ${transparentClass}" style="background: ${data.bgColor || ''}" ${rawAttr}>
        <div class="widget-delete-btn" onclick="deleteDesktopWidget(this)">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff3b30"></circle><line x1="8" y1="12" x2="16" y2="12" stroke="#fff" stroke-width="2"></line></svg>
        </div>
        ${innerContent}
    </div>`;
    
    document.getElementById('desktopGridBg').insertAdjacentHTML('afterend', widgetHTML);
    fillDesktopPlaceholders(); // 重新计算空位
    closeWidgetModal();
    bindDesktopLongPress();
    // 注意：这里不再自动保存，必须用户点击“保存”才会生效
}

function addWidgetToDesktop(type) {
    if (type === 'default') {
        if (document.getElementById('main-widget-container')) {
            alert('默认小组件已经在桌面上了！');
            return;
        }
        
        const defaultWidgetHTML = `
        <div class="widget-container" id="main-widget-container">
            <div class="widget-delete-btn" onclick="deleteDesktopWidget(this)">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff3b30"></circle><line x1="8" y1="12" x2="16" y2="12" stroke="#fff" stroke-width="2"></line></svg>
            </div>
            <div class="widget-top-bar">
                <div class="widget-btn icon-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#666" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <div class="widget-btn" contenteditable="true" spellcheck="false">#记录你有关的萌点</div>
            </div>
            <div class="widget-music">
                <div class="music-cover uploadable-img"></div>
                <div class="music-info">
                    <div class="music-title" contenteditable="true" spellcheck="false">DorisWorld</div>
                    <div class="music-sub" contenteditable="true" spellcheck="false">Doris<br>Music</div>
                </div>
            </div>
            <div class="widget-search">
                <span contenteditable="true" spellcheck="false">索菲亚公主的午后芭蕾茶话会</span>
                <span style="background:#888; color:#fff; border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px;">↑</span>
            </div>
            <div class="widget-gallery">
                <div class="gallery-item-widget uploadable-img">love</div>
                <div class="gallery-item-widget uploadable-img">Cherish</div>
                <div class="gallery-item-widget uploadable-img">|||||||</div>
            </div>
        </div>`;
        
        document.getElementById('desktopGridBg').insertAdjacentHTML('afterend', defaultWidgetHTML);
        
        document.querySelectorAll('#main-widget-container .uploadable-img').forEach(el => {
            handleImageUpload(el, (imgUrl, targetEl) => {
                targetEl.style.backgroundImage = `url(${imgUrl})`;
                targetEl.classList.add('has-image');
            });
        });
        
        fillDesktopPlaceholders(); // 重新计算空位
        closeWidgetModal();
        bindDesktopLongPress();
        // 注意：这里不再自动保存，必须用户点击“保存”才会生效
    }
}

// 页面加载时初始化渲染
window.addEventListener('DOMContentLoaded', () => {
    renderImportedWidgets();
});

document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        products: []
    };

    // Initialize App
    const initApp = async () => {
        try {
            // 1. Try Migration (only runs if needed)
            await db.migrateFromLocalStorage();

            // 2. Load Data from DB
            const products = await db.getAllProducts();

            // 3. Sort by ID descending (newest first) to match previous behavior
            state.products = products.sort((a, b) => b.id - a.id);

            // 4. Permission UI Check (Notification)
            if (Notification.permission === 'granted') {
                const stagnantCount = checkStagnantItems(); // This now might be async? No, checkStagnantItems is sync logic but calling save().
                // We need to update checkStagnantItems to be async or handle saving differently.
                // Let's handle that in the function definition.
            }

            render();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            alert('アプリの読み込みに失敗しました。');
        }
    };

    // DOM Elements - Main UI
    const grid = document.getElementById('productGrid');
    const emptyState = document.getElementById('emptyState');
    const addBtn = document.getElementById('addBtn');

    // DOM Elements - Modal
    const addModal = document.getElementById('addModal');
    const closeAddModal = document.getElementById('closeAddModal');
    const addForm = document.getElementById('addForm');
    const dropZone = document.getElementById('dropZone');
    const cameraInput = document.getElementById('cameraInput');
    const fileInput = document.getElementById('fileInput');
    const cameraBtn = document.getElementById('cameraBtn');
    const libraryBtn = document.getElementById('libraryBtn');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    // const filePrompt = document.getElementById('filePrompt'); // Removed

    // DOM Elements - Tabs & Controls
    const tabList = document.getElementById('tabList');
    const tabReport = document.getElementById('tabReport');
    const listViewControls = document.getElementById('listViewControls');
    const reportSection = document.getElementById('reportSection');

    // Global State Helpers
    let currentEditId = null;
    let currentImages = [];

    const STATUS_MAP = {
        'purchased': { label: '仕入済', class: 'status-purchased' },
        'listed': { label: '出品中', class: 'status-listed' },
        'sold': { label: '売却済', class: 'status-sold' },
        'hold': { label: '保留', class: 'status-hold' },
        'stagnant': { label: '回転悪化', class: 'status-stagnant' }
    };

    // Helper: Format Currency
    const formatCurrency = (num) => {
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num);
    };

    // Helper: Date Difference
    const getDaysDiff = (dateStr) => {
        if (!dateStr) return 0;
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Save to LocalStorage - DEPRECATED / REMOVED
    // Individual DB calls are used instead.
    // const save = () => { ... };

    // Switch Tab
    const switchTab = (tabName) => {
        // Reset dashboard visibility (simple toggle, override handles specific logic)
        const dashboardSection = document.getElementById('dashboardSection');
        const tabDashboard = document.getElementById('tabDashboard');
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (tabDashboard) tabDashboard.classList.remove('active');

        if (tabName === 'list') {
            tabList.classList.add('active');
            tabReport.classList.remove('active');
            listViewControls.style.display = 'block';
            grid.style.display = 'grid';
            reportSection.style.display = 'none';
            render();
        } else {
            tabList.classList.remove('active');
            tabReport.classList.add('active');
            listViewControls.style.display = 'none';
            grid.style.display = 'none';
            emptyState.style.display = 'none';
            reportSection.style.display = 'block';
        }
    };

    tabList.addEventListener('click', () => switchTab('list'));
    tabReport.addEventListener('click', () => switchTab('report'));

    // Render Product List
    const render = () => {
        grid.innerHTML = '';

        if (state.products.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        state.products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';

            // Image
            let imageHtml = '';
            if (product.images && product.images.length > 0) {
                imageHtml = `<img src="${product.images[0]}" class="product-image" loading="lazy">`;
            } else if (product.image) {
                imageHtml = `<img src="${product.image}" class="product-image" loading="lazy">`;
            } else {
                imageHtml = `<div class="product-image" style="background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;">No Image</div>`;
            }

            // Status
            let status = product.status || 'purchased';
            if (status === 'active') status = 'listed';

            const statusInfo = STATUS_MAP[status] || STATUS_MAP['purchased'];

            // Prices
            let priceHtml = `<div class="price-row"><span class="price-buy">仕入: ${formatCurrency(product.buyPrice)}</span></div>`;
            if (product.sellPrice) {
                const profit = product.sellPrice - product.buyPrice - ((product.costs?.commission || 0) + (product.costs?.shipping || 0) + (product.costs?.packaging || 0));
                const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
                priceHtml = `
                    <div class="price-row">
                        <span class="price-sell">売却: ${formatCurrency(product.sellPrice)}</span>
                    </div>
                    <div class="price-row">
                        <span class="price-profit ${profitClass}">利益: ${formatCurrency(profit)}</span>
                    </div>
                `;
            }

            // Quick Sell / Delete
            let actionBtn = '';
            if (status !== 'sold') {
                actionBtn = `<button class="btn-sm btn-outline" onclick="openSellModal(${product.id}); event.stopPropagation();">売却</button>`;
            }

            card.innerHTML = `
                ${imageHtml}
                <div class="product-info">
                    <div class="product-header">
                        <h3 class="product-title status-text-${statusInfo.class.replace('status-', '')}">${product.name}</h3>
                        ${actionBtn}
                        <button class="btn-sm btn-ghost" onclick="deleteProduct(${product.id}); event.stopPropagation();" style="color:#ef4444;">🗑️</button>
                    </div>
                    ${priceHtml}
                    <div class="product-meta">
                        <span>${product.listingDate ? product.listingDate : '未出品'}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => openEditModal(product.id));
            grid.appendChild(card);
        });
    };

    // Render Image Preview Grid
    const renderImagePreviews = () => {
        imagePreviewContainer.innerHTML = '';
        if (currentImages.length > 0) {
            // filePrompt.style.display = 'none'; // Removed
            currentImages.forEach((imgSrc, index) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <img src="${imgSrc}">
                    <button type="button" class="remove-image-btn" onclick="removeImage(${index})">×</button>
                `;
                imagePreviewContainer.appendChild(div);
            });
        } else {
            // filePrompt.style.display = 'block'; // Removed
        }
    };

    // Remove Image Helper
    window.removeImage = (index) => {
        currentImages.splice(index, 1);
        renderImagePreviews();
    };

    // Image Handling
    const handleFiles = (files) => {
        if (!files.length) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentImages.push(e.target.result);
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        });
    };

    // Button Click Handlers
    cameraBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling if needed
        cameraInput.click();
    });

    libraryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Input Change Handlers
    cameraInput.addEventListener('change', (e) => handleFiles(e.target.files));
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Drag & Drop (PC fallback)
    dropZone.addEventListener('click', (e) => {
        // If clicking background area (not buttons or previews), default to Library
        if (e.target === dropZone || e.target === document.getElementById('uploadButtons')) {
            // Optional: Do nothing or trigger library?
            // Let's do nothing to enforce using buttons, or trigger library logic.
            // Given buttons are prominent, clicking empty space might be accidental.
            // But for usability, clicking the big box often means "upload".
            // Let's trigger library for standard behavior on PC.
            // fileInput.click(); 
        }
    });

    // Drag & Drop Events

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#cbd5e1';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';
        handleFiles(e.dataTransfer.files);
    });

    // Add Item Logic
    addBtn.addEventListener('click', () => {
        currentEditId = null;
        document.querySelector('.modal-title').textContent = '新しい商品';
        document.querySelector('#addForm button[type="submit"]').textContent = '登録する';

        addForm.reset();
        document.getElementById('itemStatus').value = 'purchased'; // Default
        currentImages = [];
        renderImagePreviews();

        // Hide Delete Button for New Items
        document.getElementById('modalDeleteBtn').style.display = 'none';

        addModal.classList.add('active');
    });

    // Expose openEditModal
    window.openEditModal = (id) => {
        const product = state.products.find(p => p.id === id);
        if (!product) return;

        currentEditId = id;
        document.querySelector('.modal-title').textContent = '商品を修正';
        document.querySelector('#addForm button[type="submit"]').textContent = '更新する';

        // Show and Bind Delete Button
        const deleteBtn = document.getElementById('modalDeleteBtn');
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => {
            if (confirm('本当に削除しますか？')) {
                const index = state.products.findIndex(p => p.id === id);
                if (index !== -1) {
                    state.products.splice(index, 1);
                    db.deleteProduct(id).then(() => {
                        render();
                        addModal.classList.remove('active');
                    });
                }
            }
        };

        // Fill form
        document.getElementById('itemName').value = product.name;
        document.getElementById('buyPrice').value = product.buyPrice;
        document.getElementById('purchaseDate').value = product.purchaseDate || '';
        document.getElementById('listingDate').value = product.listingDate || '';
        document.getElementById('editSellPrice').value = product.sellPrice || '';
        document.getElementById('saleDate').value = product.saleDate || '';
        document.getElementById('itemMemo').value = product.memo || '';

        // Fill costs
        const costs = product.costs || {};
        document.getElementById('costCommission').value = costs.commission || '';
        document.getElementById('costShipping').value = costs.shipping || '';
        document.getElementById('costPackaging').value = costs.packaging || '';

        // Handle Status
        let status = product.status;
        if (status === 'active') status = 'listed';
        if (!STATUS_MAP[status]) status = 'purchased';

        // Stagnant Suggestion Logic
        if (status === 'listed' && product.listingDate) {
            const daysDiff = getDaysDiff(product.listingDate);
            if (daysDiff >= 30) {
                // Suggest stagnant
                status = 'stagnant';
                // Could alert user: "出品から30日経過しています。ステータスを'回転悪化'に変更しますか？"
                // For now, auto-select it in dropdown for suggestion
            }
        }
        document.getElementById('itemStatus').value = status;

        // Handle Images
        currentImages = product.images ? [...product.images] : (product.image ? [product.image] : []);
        renderImagePreviews();

        addModal.classList.add('active');
    };

    // Expose deleteProduct
    window.deleteProduct = (id) => {
        if (confirm('本当にこの商品を削除しますか？\n削除したデータは元に戻せません。')) {
            const index = state.products.findIndex(p => p.id === id);
            if (index !== -1) {
                state.products.splice(index, 1);
                db.deleteProduct(id).then(render);
            }
        }
    };

    closeAddModal.addEventListener('click', () => addModal.classList.remove('active'));

    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
            const name = document.getElementById('itemName').value;
            const buyPrice = parseInt(document.getElementById('buyPrice').value);
            const purchaseDate = document.getElementById('purchaseDate').value;
            const listingDate = document.getElementById('listingDate').value;

            const sellPriceInput = document.getElementById('editSellPrice').value;
            const sellPrice = sellPriceInput ? parseInt(sellPriceInput) : null;
            const saleDate = document.getElementById('saleDate').value;
            const memo = document.getElementById('itemMemo').value;
            let status = document.getElementById('itemStatus').value;

            // Auto 'Sold' status logic
            if (sellPrice !== null && saleDate) {
                status = 'sold';
            }

            // Costs
            const costs = {
                commission: parseInt(document.getElementById('costCommission').value) || 0,
                shipping: parseInt(document.getElementById('costShipping').value) || 0,
                packaging: parseInt(document.getElementById('costPackaging').value) || 0
            };

            if (currentEditId !== null) {
                // Update
                const index = state.products.findIndex(p => p.id === currentEditId);
                if (index !== -1) {
                    state.products[index].name = name;
                    state.products[index].buyPrice = buyPrice;
                    state.products[index].purchaseDate = purchaseDate;
                    state.products[index].listingDate = listingDate;

                    state.products[index].sellPrice = sellPrice;
                    state.products[index].saleDate = saleDate;
                    state.products[index].status = status;
                    state.products[index].costs = costs;
                    state.products[index].memo = memo;

                    state.products[index].images = currentImages;
                    delete state.products[index].image;

                    db.saveProduct(state.products[index]).then(() => {
                        render();
                        addModal.classList.remove('active');
                    });
                }
            } else {
                // Create
                const newProduct = {
                    id: Date.now(),
                    name,
                    buyPrice,
                    purchaseDate,
                    listingDate,
                    images: currentImages,
                    status: status, // Defaults to 'purchased' or selected
                    sellPrice: sellPrice,
                    saleDate,
                    costs: costs,
                    memo: memo
                };

                // Add to State
                state.products.unshift(newProduct);

                // Save to DB
                db.saveProduct(newProduct).then(() => {
                    render();
                    addModal.classList.remove('active');
                });
            }
        } catch (error) {
            alert('登録中にエラーが発生しました: ' + error.message);
            console.error(error);
        }
    });

    // --- Mobile Optimization Logic ---

    // Status Chips Logic
    const statusChips = document.querySelectorAll('.status-chip');
    const statusSelect = document.getElementById('itemStatus');

    const updateChips = (selectedValue) => {
        statusChips.forEach(chip => {
            if (chip.dataset.value === selectedValue) {
                chip.classList.add('active');
                // Ensure specific styling for statuses based on CSS if needed, 
                // currently just 'active' class which maps to primary color.
            } else {
                chip.classList.remove('active');
            }
        });
        statusSelect.value = selectedValue;
    };

    statusChips.forEach(chip => {
        chip.addEventListener('click', () => {
            updateChips(chip.dataset.value);
        });
    });

    // Sync Select change to Chips (in case PC view changes it or logic does)
    statusSelect.addEventListener('change', () => {
        updateChips(statusSelect.value);
    });

    // Enhance Open Edit Modal for Defaults
    const originalOpenEditModal = window.openEditModal;
    window.openEditModal = (id) => {
        originalOpenEditModal(id);
        // Sync chips to the current status
        const product = state.products.find(p => p.id === id);
        if (product) updateChips(product.status);
    };

    // Enhance Add Button for Defaults
    const originalAddBtnClick = addBtn.onclick;
    // Note: addBtn has event listener, not onclick. We need to hook into the existing listener or add a new one that runs after?
    // Listeners run in order. We can just add another listener to addBtn.

    addBtn.addEventListener('click', () => {
        // 1. Auto-Focus Name
        setTimeout(() => {
            const nameInput = document.getElementById('itemName');
            nameInput.focus();
        }, 100); // Small delay for modal animation

        // 2. Set Default Date to Today
        const today = new Date().toISOString().split('T')[0];
        const purchaseDateInput = document.getElementById('purchaseDate');
        if (!purchaseDateInput.value) {
            purchaseDateInput.value = today;
        }

        // 3. Reset Chips
        updateChips('purchased');
    });



    // --- One-Tap Sell Logic ---

    // DOM Elements - Sell Modal
    const sellModal = document.getElementById('sellModal');
    const closeSellModal = document.getElementById('closeSellModal');
    const sellForm = document.getElementById('sellForm');
    let currentSellId = null;

    // Open Simple Sell Modal
    window.openSellModal = (id) => {
        const product = state.products.find(p => p.id === id);
        if (!product) return;

        currentSellId = id;
        document.getElementById('sellItemName').textContent = product.name;
        document.getElementById('sellPrice').value = product.sellPrice || '';

        // Set Default Date to Today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('sellDate').value = product.saleDate || today;

        sellModal.classList.add('active');

        // Auto-focus price
        setTimeout(() => {
            document.getElementById('sellPrice').focus();
        }, 100);
    };

    closeSellModal.addEventListener('click', () => sellModal.classList.remove('active'));

    sellForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!confirm('この商品を「売却済」にします。よろしいですか？')) {
            return;
        }

        const price = parseInt(document.getElementById('sellPrice').value);
        const date = document.getElementById('sellDate').value;

        const index = state.products.findIndex(p => p.id === currentSellId);
        if (index !== -1) {
            state.products[index].sellPrice = price;
            state.products[index].saleDate = date;
            state.products[index].status = 'sold';
            // Costs and other fields remain unchanged

            db.saveProduct(state.products[index]).then(() => {
                render();
                sellModal.classList.remove('active');
            });
        }
    });

    // Initial Render
    // Initial Render moved to initApp
    initApp();

    // --- Stagnant Inventory Logic ---

    // Check and Update Stagnant Items
    const checkStagnantItems = () => {
        const checkDate = new Date();
        // 30 days ago
        checkDate.setDate(checkDate.getDate() - 30);
        const thresholdDate = checkDate.toISOString().split('T')[0];

        let hasUpdates = false;
        let stagnantCount = 0;

        state.products.forEach(p => {
            // Target: Listed items older than 30 days
            if (p.status === 'listed' && p.listingDate && p.listingDate <= thresholdDate) {
                p.status = 'stagnant';
                hasUpdates = true;
                stagnantCount++;
            } else if (p.status === 'stagnant') {
                // Count existing stagnant items too
                stagnantCount++;
            }
        });

        if (hasUpdates) {
            // Save all stagnant updates
            // Since this might be multiple, we allow it to be async in background
            const updates = state.products.filter(p => p.status === 'stagnant');
            updates.forEach(p => db.saveProduct(p));
            render(); // Re-render to show updates
        }

        return stagnantCount;
    };

    // Send Notification
    const sendDailyNotification = (count) => {
        if (count === 0) return;

        // Check last notification date
        const today = new Date().toISOString().split('T')[0];
        const lastNotified = localStorage.getItem('last_notification_date');

        if (lastNotified === today) return;

        // Verify Permission
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            try {
                new Notification('アパレル管理: 回転悪化の通知', {
                    body: `${count}件の商品が30日以上売れていません。価格や写真を見直しましょう。`,
                    icon: './icon-192.png'
                });
                localStorage.setItem('last_notification_date', today);
            } catch (e) {
                console.error('Notification failed', e);
            }
        }
    };

    // Run Checks
    const stagnantCount = checkStagnantItems();

    // Notification logic runs after permission check/request
    // We'll add a UI trigger for permission if not granted
    if (Notification.permission === 'default') {
        // Option: Show a small banner? For now, we will add a button in Report section via HTML update
    } else if (Notification.permission === 'granted') {
        sendDailyNotification(stagnantCount);
    }

    // --- Dashboard Logic ---

    const dashboardSection = document.getElementById('dashboardSection');
    const tabDashboard = document.getElementById('tabDashboard');

    const renderDashboard = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

        // Date Header
        document.getElementById('dashDate').textContent = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

        // Filter Sold Items
        const soldItems = state.products.filter(p => p.status === 'sold' && p.saleDate);

        // Today's Stats
        const todayItems = soldItems.filter(p => p.saleDate === todayStr);
        const todayStats = calculatePeriodStats(todayItems);

        document.getElementById('dashTodayCount').textContent = `${todayStats.count}点`;
        document.getElementById('dashTodaySales').textContent = formatCurrency(todayStats.sales);
        document.getElementById('dashTodayProfit').textContent = formatCurrency(todayStats.profit);

        // Month's Stats
        const monthItems = soldItems.filter(p => p.saleDate.startsWith(currentMonthStr));
        const monthStats = calculatePeriodStats(monthItems);

        document.getElementById('dashMonthCount').textContent = `${monthStats.count}点`;
        document.getElementById('dashMonthSales').textContent = formatCurrency(monthStats.sales);
        document.getElementById('dashMonthProfit').textContent = formatCurrency(monthStats.profit);

        // Alert Items
        const stagnantCount = state.products.filter(p => p.status === 'stagnant').length;
        const alertCard = document.getElementById('dashAlertCard');
        if (stagnantCount > 0) {
            alertCard.style.display = 'block';
            document.getElementById('dashStagnantCount').textContent = `${stagnantCount}件`;
        } else {
            alertCard.style.display = 'none';
        }
    };

    const calculatePeriodStats = (items) => {
        return items.reduce((acc, p) => {
            const costs = p.costs || { commission: 0, shipping: 0, packaging: 0 };
            const totalCosts = (costs.commission || 0) + (costs.shipping || 0) + (costs.packaging || 0);
            const profit = p.sellPrice - p.buyPrice - totalCosts;

            acc.count++;
            acc.sales += p.sellPrice;
            acc.profit += profit;
            return acc;
        }, { count: 0, sales: 0, profit: 0 });
    };

    // Dashboard Actions
    document.getElementById('dashBtnAdd').addEventListener('click', () => {
        addBtn.click(); // Trigger existing add modal
    });

    document.getElementById('dashBtnList').addEventListener('click', () => {
        switchTab('list');
    });

    document.getElementById('dashAlertCard').addEventListener('click', () => {
        switchTab('list');
        // Ideally filter by stagnant, but simple switch is fine for now
    });

    // Modified Switch Tab to include Dashboard
    const originalSwitchTab = switchTab;
    const newSwitchTab = (tab) => {
        if (tab === 'dashboard') {
            tabList.classList.remove('active');
            tabReport.classList.remove('active');
            if (tabDashboard) tabDashboard.classList.add('active');

            listViewControls.style.display = 'none';
            grid.style.display = 'none';
            emptyState.style.display = 'none';
            reportSection.style.display = 'none';
            dashboardSection.style.display = 'block';

            renderDashboard();
        } else {
            if (tabDashboard) tabDashboard.classList.remove('active');
            dashboardSection.style.display = 'none';
            originalSwitchTab(tab);
        }
    };
    // Override local switchTab function reference within the scope if possible?
    // Actually we need to update the event listeners or wrappers. 
    // Since original switchTab is const, we can't overwrite it easily in same scope.
    // Let's just use a wrapper for the listeners.

    // Re-bind tab listeners
    if (tabDashboard) {
        tabDashboard.addEventListener('click', () => newSwitchTab('dashboard'));
    }
    // Note: tabList and tabReport already have listeners calling switchTab. 
    // We need to update their listeners or update the switchTab implementation.
    // Since we can't specificly 'unlisten' anonymous functions easily, we can just ensure newSwitchTab handles the hiding logic correctly
    // and rely on the fact that existing switchTab handles list/report toggling.
    // BUT existing switchTab doesn't know about dashboardSection. So we DO need to modify the original switchTab logic.
    // The easist way is to Replace the original switchTab function declaration in the code.
    // But since I am appending code, I cannot change the original calculation logic easily without a big replace.
    // However, I can inject the hiding of dashboardSection into the original switchTab? No.

    // Let's try to overwrite the behavior by updating the click handlers logic? No.
    // Plan: I'll use `replace_file_content` to MODIFY the original switchTab function to handle 'dashboard' and hiding logic.

    // Initial View Logic


    // --- Google Drive Backup Logic ---

    const CLIENT_ID = '762899577808-it6q0cqjjgn3eqltm04nfektqcvhebtg.apps.googleusercontent.com';
    const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
    let tokenClient;
    let gToken = localStorage.getItem('google_access_token');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    // 1. Initialize Google Auth
    window.initGoogleAuth = () => {
        if (!window.google) {
            // Wait for script to load if not ready
            setTimeout(initGoogleAuth, 500);
            return;
        }

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse.access_token) {
                    gToken = tokenResponse.access_token;
                    localStorage.setItem('google_access_token', gToken);
                    updateLoginUI(true);
                    // Do immediate backup after login
                    backupToDrive(state.products);
                }
            },
        });

        // Initial UI State
        if (gToken) {
            updateLoginUI(true);
            // Auto backup on app load if logged in
            backupToDrive(state.products);
        } else {
            updateLoginUI(false);
        }

        // Button Listener
        googleLoginBtn.onclick = handleGoogleLogin;
    };

    // 2. Handle Login Click
    window.handleGoogleLogin = () => {
        if (gToken) {
            // Already logged in -> Maybe logout? Or purely status indicator.
            // User requirement says "Skip login screen if authenticated".
            // Let's allow re-login/refresh if clicked, or logout.
            // For now, simple Alert or re-auth to refresh token if expired.
            if (confirm('Googleアカウントからログアウトしますか？')) {
                gToken = null;
                localStorage.removeItem('google_access_token');
                updateLoginUI(false);
            }
        } else {
            // Force account selection prompt (Via initTokenClient)
            tokenClient.requestAccessToken();
        }
    };

    const updateLoginUI = (isLoggedIn) => {
        googleLoginBtn.style.display = 'flex'; // Ensure visible once initialized
        if (isLoggedIn) {
            googleLoginBtn.innerHTML = `
                <span style="color: #059669; font-weight: bold;">✔ Backup ON</span>
            `;
            googleLoginBtn.title = "ログアウトするにはクリック";
        } else {
            googleLoginBtn.innerHTML = `
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G">
                <span>Google Login</span>
            `;
            googleLoginBtn.title = "Google Driveにバックアップ";
        }
    };

    // 3. Backup to Drive
    window.backupToDrive = async (data) => {
        if (!gToken) return;

        console.log('Starting Backup...');
        const filename = `apparel_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`;
        const fileContent = JSON.stringify(data, null, 2);
        const fileData = new Blob([fileContent], { type: 'application/json' });

        try {
            // A. Search for existing file
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${filename}' and 'appDataFolder' in parents&spaces=appDataFolder`;
            const searchRes = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${gToken}` }
            });

            if (searchRes.status === 401) {
                // Token expired
                console.warn('Token expired');
                gToken = null;
                localStorage.removeItem('google_access_token');
                updateLoginUI(false);
                alert('Google認証の有効期限が切れました。\n再度ログインしてバックアップを有効にしてください。');
                return;
            }

            const searchJson = await searchRes.json();
            const existingFile = searchJson.files && searchJson.files.length > 0 ? searchJson.files[0] : null;

            // B. Upload (Update or Create)
            const metadata = {
                name: filename,
                mimeType: 'application/json',
                parents: existingFile ? [] : ['appDataFolder'] // Only set parent on create
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', fileData);

            let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (existingFile) {
                uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
                method = 'PATCH';
            }

            const uploadRes = await fetch(uploadUrl, {
                method: method,
                headers: { 'Authorization': `Bearer ${gToken}` },
                body: form
            });

            if (!uploadRes.ok) {
                throw new Error(`Upload failed: ${uploadRes.status}`);
            }

            console.log('Backup successful');
            // Optional: Subtle notification
            // const toast = document.createElement('div');
            // toast.textContent = 'バックアップ完了';
            // ... (Simple keeping per requirements "Alert on error")

        } catch (error) {
            console.error('Backup error:', error);
            alert(`バックアップに失敗しました: ${error.message}`);
        }
    };

    // Start Auth Init
    // Delay slightly to ensure google script loaded or poll
    initGoogleAuth();

}); // End of DOMContentLoaded

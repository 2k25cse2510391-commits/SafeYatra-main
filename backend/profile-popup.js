/**
 * SafeYatra - Profile Popup Management Script
 * Handles opening/closing the profile popup drawer, rendering real-time profile data,
 * editing profile details, syncing changes with SafeYatraDB / Firebase, and logging out.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Curated Preset Travel Avatars
    const PRESET_AVATARS = [
        { id: "preset-1", name: "Traveler 1", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-2", name: "Traveler 2", url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-3", name: "Explorer", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-4", name: "Adventurer", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-5", name: "Nomad", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-6", name: "Backpacker", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80" }
    ];

    const topProfileBtn = document.getElementById('topProfileBtn');
    const profilePopupOverlay = document.getElementById('profilePopupOverlay');
    const closeProfilePopupBtn = document.getElementById('closeProfilePopupBtn');

    const popupAvatarImg = document.getElementById('popupAvatarImg') || (profilePopupOverlay ? profilePopupOverlay.querySelector('.user-avatar-img') : null);
    const popupAvatarCameraBtn = document.getElementById('popupAvatarCameraBtn');
    const popupAvatarInput = document.getElementById('popupAvatarInput');

    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileForm = document.getElementById('profileForm');

    // Modal Photo Editor elements
    const modalAvatarPreview = document.getElementById('modalAvatarPreview');
    const modalAvatarInput = document.getElementById('modalAvatarInput');
    const btnRemoveModalPhoto = document.getElementById('btnRemoveModalPhoto');
    const presetAvatarsGrid = document.getElementById('presetAvatarsGrid');

    // Form input fields
    const inputName = document.getElementById('inputName');
    const inputMobile = document.getElementById('inputMobile');
    const inputAge = document.getElementById('inputAge');
    const inputBloodGroup = document.getElementById('inputBloodGroup');
    const inputEmergency = document.getElementById('inputEmergency');
    const inputEmail = document.getElementById('inputEmail');
    const inputAddress = document.getElementById('inputAddress');

    // Track modal selected photo
    let modalSelectedPhotoUrl = "";

    // Sign out button
    const signOutBtn = document.getElementById('signOutBtn');

    /**
     * Render profile data into UI elements
     */
    function renderProfilePopupUI(data) {
        if (!data) return;

        const userNameEl = document.getElementById('displayUserName');
        const userMobileEl = document.getElementById('displayUserMobile');
        const userEmailEl = document.getElementById('displayUserEmail');

        const displayUserAge = document.getElementById('displayUserAge');
        const displayUserBlood = document.getElementById('displayUserBlood');
        const displayUserEmergency = document.getElementById('displayUserEmergency');
        const displayUserAddress = document.getElementById('displayUserAddress');

        const touristIdNameEl = document.getElementById('displayTouristName');
        const emergencyCountText = document.getElementById('emergencyCountText');

        // Also update greeting & names on the main index page
        const userNameTitle = document.querySelector('.user-name-title');
        const displayTouristNameIndex = document.getElementById('displayTouristNameIndex');

        const name = data.name || "Tourist";
        const rawMobile = data.mobile || (typeof SafeYatraDB !== 'undefined' ? SafeYatraDB.getLoggedInMobile() : "");
        const formattedMobile = rawMobile ? (rawMobile.startsWith('+') ? rawMobile : `+91 ${rawMobile.trim()}`) : "";

        if (userNameEl) userNameEl.textContent = name;
        if (userMobileEl) {
            userMobileEl.textContent = formattedMobile;
            userMobileEl.style.display = formattedMobile ? 'block' : 'none';
        }
        if (userEmailEl) {
            userEmailEl.textContent = data.email || "";
            userEmailEl.style.display = (data.email && data.email.trim()) ? 'block' : 'none';
        }

        if (displayUserAge) displayUserAge.textContent = data.age ? `${data.age} Years` : "Not set";
        if (displayUserBlood) displayUserBlood.textContent = data.bloodGroup || "O+";
        if (displayUserEmergency) displayUserEmergency.textContent = data.emergencyContact || "1234567890";
        if (displayUserAddress) displayUserAddress.textContent = data.address || "Location Not Set";

        if (touristIdNameEl) touristIdNameEl.textContent = name;

        if (emergencyCountText) {
            emergencyCountText.textContent = `Emergency: ${data.emergencyContact || "1234567890"}`;
        }

        if (userNameTitle && data.name) {
            userNameTitle.textContent = `Namaste, ${data.name}!`;
        }
        if (displayTouristNameIndex && data.name) {
            displayTouristNameIndex.textContent = data.name;
        }

        // Render popup avatar image
        const avatarUrl = SafeYatraDB.getAvatarUrl(data);
        if (popupAvatarImg) {
            popupAvatarImg.src = avatarUrl;
            popupAvatarImg.onerror = () => {
                popupAvatarImg.src = SafeYatraDB.getDefaultAvatar(data.name);
            };
        }

        // Also update topbar profile button if customized
        if (topProfileBtn) {
            if (data.photoUrl && data.photoUrl.trim()) {
                topProfileBtn.innerHTML = `<img src="${data.photoUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                topProfileBtn.innerHTML = `<i class="fa-solid fa-user"></i>`;
            }
        }
    }

    // Direct Avatar Camera Upload Handler in Popup Drawer
    if (popupAvatarCameraBtn && popupAvatarInput) {
        popupAvatarCameraBtn.addEventListener('click', () => {
            popupAvatarInput.click();
        });

        popupAvatarInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                showToast("Compressing & saving photo...");
                const compressedBase64 = await SafeYatraDB.compressImage(file, 400, 400, 0.85);
                const updated = await SafeYatraDB.updateProfilePhoto(compressedBase64);
                renderProfilePopupUI(updated);
                showToast("Profile Photo Saved to Database!");
            } catch (err) {
                console.error("Avatar upload failed:", err);
                showToast("Failed to upload photo: " + (err.message || "Invalid image"));
            } finally {
                popupAvatarInput.value = "";
            }
        });
    }

    // Initialize Preset Avatars in Modal
    function initPresetAvatars(activeUrl) {
        if (!presetAvatarsGrid) return;
        presetAvatarsGrid.innerHTML = "";

        PRESET_AVATARS.forEach((item) => {
            const chip = document.createElement('button');
            chip.type = "button";
            chip.className = `preset-avatar-chip ${activeUrl === item.url ? 'selected' : ''}`;
            chip.title = item.name;
            chip.innerHTML = `<img src="${item.url}" alt="${item.name}">`;

            chip.addEventListener('click', () => {
                modalSelectedPhotoUrl = item.url;
                if (modalAvatarPreview) modalAvatarPreview.src = item.url;

                document.querySelectorAll('.preset-avatar-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
            });

            presetAvatarsGrid.appendChild(chip);
        });
    }

    // Load initial profile data
    if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getUserProfile) {
        try {
            const initialProfile = await SafeYatraDB.getUserProfile();
            renderProfilePopupUI(initialProfile);
        } catch (err) {
            console.warn("Could not load initial user profile:", err);
        }
    }

    /**
     * 1. Open Profile Popup
     */
    function openProfilePopup() {
        if (!profilePopupOverlay) return;
        // Refresh profile data from DB
        if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getUserProfile) {
            SafeYatraDB.getUserProfile().then(profile => {
                if (profile) renderProfilePopupUI(profile);
            }).catch(console.warn);
        }
        profilePopupOverlay.classList.add('active');
        profilePopupOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 2. Close Profile Popup
     */
    function closeProfilePopup() {
        if (!profilePopupOverlay) return;
        profilePopupOverlay.classList.remove('active');
        profilePopupOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    if (topProfileBtn) {
        topProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openProfilePopup();
        });
    }

    if (closeProfilePopupBtn) {
        closeProfilePopupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeProfilePopup();
        });
    }

    // Close on backdrop click
    if (profilePopupOverlay) {
        profilePopupOverlay.addEventListener('click', (e) => {
            if (e.target === profilePopupOverlay) {
                closeProfilePopup();
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (editProfileModal && editProfileModal.classList.contains('active')) {
                editProfileModal.classList.remove('active');
            } else if (profilePopupOverlay && profilePopupOverlay.classList.contains('active')) {
                closeProfilePopup();
            }
        }
    });

    /**
     * 3. Edit Profile Modal Handling
     */
    if (editProfileBtn && editProfileModal) {
        editProfileBtn.addEventListener('click', async () => {
            if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.getUserProfile) {
                const current = await SafeYatraDB.getUserProfile();
                if (inputName) inputName.value = current.name || "";
                if (inputMobile) inputMobile.value = current.mobile || "";
                if (inputAge) inputAge.value = current.age || "";
                if (inputBloodGroup) inputBloodGroup.value = current.bloodGroup || "O+";
                if (inputEmergency) inputEmergency.value = current.emergencyContact || "1234567890";
                if (inputEmail) inputEmail.value = current.email || "";
                if (inputAddress) inputAddress.value = current.address || "";

                // Set initial photo preview & presets
                modalSelectedPhotoUrl = current.photoUrl || "";
                const currentAvatarUrl = SafeYatraDB.getAvatarUrl(current);
                if (modalAvatarPreview) {
                    modalAvatarPreview.src = currentAvatarUrl;
                }
                initPresetAvatars(current.photoUrl);
            }
            editProfileModal.classList.add('active');
        });
    }

    // Modal Avatar File Upload Handler
    if (modalAvatarInput) {
        modalAvatarInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                showToast("Processing photo...");
                const compressedBase64 = await SafeYatraDB.compressImage(file, 400, 400, 0.85);
                modalSelectedPhotoUrl = compressedBase64;
                if (modalAvatarPreview) {
                    modalAvatarPreview.src = compressedBase64;
                }
                document.querySelectorAll('.preset-avatar-chip').forEach(c => c.classList.remove('selected'));
                showToast("Photo ready! Click 'Save Profile' to store.");
            } catch (err) {
                console.error("Modal image error:", err);
                showToast("Error reading photo: " + (err.message || "Invalid image"));
            } finally {
                modalAvatarInput.value = "";
            }
        });
    }

    // Modal Avatar Remove Handler
    if (btnRemoveModalPhoto) {
        btnRemoveModalPhoto.addEventListener('click', () => {
            modalSelectedPhotoUrl = "";
            const defaultUrl = SafeYatraDB.getDefaultAvatar(inputName ? inputName.value : "");
            if (modalAvatarPreview) {
                modalAvatarPreview.src = defaultUrl;
            }
            document.querySelectorAll('.preset-avatar-chip').forEach(c => c.classList.remove('selected'));
            showToast("Photo reset to default avatar");
        });
    }

    if (closeProfileModal && editProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            editProfileModal.classList.remove('active');
        });
    }

    if (editProfileModal) {
        editProfileModal.addEventListener('click', (e) => {
            if (e.target === editProfileModal) {
                editProfileModal.classList.remove('active');
            }
        });
    }

    /**
     * 4. Save Profile Form Handler
     */
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const updatedData = {
                name: inputName ? inputName.value.trim() : "",
                mobile: inputMobile ? inputMobile.value.trim() : "",
                age: inputAge ? inputAge.value.trim() : "",
                bloodGroup: inputBloodGroup ? inputBloodGroup.value.trim() : "O+",
                emergencyContact: inputEmergency ? inputEmergency.value.trim() : "",
                email: inputEmail ? inputEmail.value.trim() : "",
                address: inputAddress ? inputAddress.value.trim() : "",
                photoUrl: modalSelectedPhotoUrl
            };

            if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.saveUserProfile) {
                const saved = await SafeYatraDB.saveUserProfile(updatedData);
                renderProfilePopupUI(saved);
            }

            if (editProfileModal) editProfileModal.classList.remove('active');
            showToast("Profile & Photo Saved to Database!");
        });
    }

    /**
     * 5. Sign Out Handler
     */
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.logout) {
                SafeYatraDB.logout();
            }
        });
    }

    /**
     * 6. Toast Notification Helper
     */
    function showToast(msg) {
        const toastEl = document.getElementById('toast');
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, 3200);
    }
});

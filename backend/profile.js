/**
 * SafeYatra AI - Profile Management Page Script
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Auth Guard
    if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.requireAuth) {
        SafeYatraDB.requireAuth();
    }

    // Curated Preset Travel Avatars
    const PRESET_AVATARS = [
        { id: "preset-1", name: "Traveler 1", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-2", name: "Traveler 2", url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-3", name: "Explorer", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-4", name: "Adventurer", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-5", name: "Nomad", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" },
        { id: "preset-6", name: "Backpacker", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80" }
    ];

    // DOM Elements - Main Page
    const profileAvatarImg = document.getElementById('profileAvatarImg') || document.querySelector('.user-avatar-img');
    const directAvatarCameraBtn = document.getElementById('directAvatarCameraBtn');
    const directAvatarInput = document.getElementById('directAvatarInput');

    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileForm = document.getElementById('profileForm');

    // DOM Elements - Modal Photo Editor
    const modalAvatarPreview = document.getElementById('modalAvatarPreview');
    const modalAvatarInput = document.getElementById('modalAvatarInput');
    const btnRemoveModalPhoto = document.getElementById('btnRemoveModalPhoto');
    const presetAvatarsGrid = document.getElementById('presetAvatarsGrid');

    // Input Fields
    const inputName = document.getElementById('inputName');
    const inputMobile = document.getElementById('inputMobile');
    const inputAge = document.getElementById('inputAge');
    const inputBloodGroup = document.getElementById('inputBloodGroup');
    const inputEmergency = document.getElementById('inputEmergency');
    const inputEmail = document.getElementById('inputEmail');
    const inputAddress = document.getElementById('inputAddress');

    // Track modal selected photo
    let modalSelectedPhotoUrl = "";

    // 2. Fetch User Profile from Database
    let profile = await SafeYatraDB.getUserProfile();
    renderProfileUI(profile);

    // Render Profile UI Card Data Live
    function renderProfileUI(data) {
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

        if (userNameEl) userNameEl.textContent = data.name || "Tourist";
        if (userMobileEl) userMobileEl.textContent = data.mobile || "";
        if (userEmailEl) userEmailEl.textContent = data.email || "";

        if (displayUserAge) displayUserAge.textContent = data.age ? `${data.age} Years` : "Not set";
        if (displayUserBlood) displayUserBlood.textContent = data.bloodGroup || "O+";
        if (displayUserEmergency) displayUserEmergency.textContent = data.emergencyContact || "1234567890";
        if (displayUserAddress) displayUserAddress.textContent = data.address || "Location Not Set";

        if (touristIdNameEl) touristIdNameEl.textContent = data.name || "Tourist";

        if (emergencyCountText) {
            emergencyCountText.textContent = `Emergency: ${data.emergencyContact || "1234567890"}`;
        }

        // Render Profile Avatar Photo
        const avatarUrl = SafeYatraDB.getAvatarUrl(data);
        if (profileAvatarImg) {
            profileAvatarImg.src = avatarUrl;
            profileAvatarImg.onerror = () => {
                profileAvatarImg.src = SafeYatraDB.getDefaultAvatar(data.name);
            };
        }
    }

    // 3. Direct Avatar Camera Button Handler
    if (directAvatarCameraBtn && directAvatarInput) {
        directAvatarCameraBtn.addEventListener('click', () => {
            directAvatarInput.click();
        });

        directAvatarInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                showToast("Compressing & uploading photo...");
                const compressedBase64 = await SafeYatraDB.compressImage(file, 400, 400, 0.85);
                
                // Save directly to Firestore and LocalStorage
                const updated = await SafeYatraDB.updateProfilePhoto(compressedBase64);
                renderProfileUI(updated);
                showToast("Profile Photo Saved to Database!");
            } catch (err) {
                console.error("Avatar upload failed:", err);
                showToast("Failed to upload photo: " + (err.message || "Invalid image"));
            } finally {
                directAvatarInput.value = "";
            }
        });
    }

    // 4. Initialize Preset Avatars in Modal
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

                // Update selected highlight
                document.querySelectorAll('.preset-avatar-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
            });

            presetAvatarsGrid.appendChild(chip);
        });
    }

    // 5. Open Edit Profile Modal
    if (editProfileBtn && editProfileModal) {
        editProfileBtn.addEventListener('click', async () => {
            const current = await SafeYatraDB.getUserProfile();
            if (inputName) inputName.value = current.name || "";
            if (inputMobile) inputMobile.value = current.mobile || "";
            if (inputAge) inputAge.value = current.age || "";
            if (inputBloodGroup) inputBloodGroup.value = current.bloodGroup || "O+";
            if (inputEmergency) inputEmergency.value = current.emergencyContact || "1234567890";
            if (inputEmail) inputEmail.value = current.email || "";
            if (inputAddress) inputAddress.value = current.address || "";

            // Initialize photo preview & presets in modal
            modalSelectedPhotoUrl = current.photoUrl || "";
            const currentAvatarUrl = SafeYatraDB.getAvatarUrl(current);
            if (modalAvatarPreview) {
                modalAvatarPreview.src = currentAvatarUrl;
            }
            initPresetAvatars(current.photoUrl);

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
                // Deselect preset avatars
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

    // 6. Close Modal Handlers
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

    // 7. Save Form Handler
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const updatedData = {
                name: inputName.value.trim(),
                mobile: inputMobile.value.trim(),
                age: inputAge.value.trim(),
                bloodGroup: inputBloodGroup.value.trim(),
                emergencyContact: inputEmergency.value.trim(),
                email: inputEmail.value.trim(),
                address: inputAddress.value.trim(),
                photoUrl: modalSelectedPhotoUrl
            };

            const saved = await SafeYatraDB.saveUserProfile(updatedData);
            renderProfileUI(saved);

            if (editProfileModal) editProfileModal.classList.remove('active');
            showToast("Profile & Photo Saved to Database!");
        });
    }

    // 8. Sign Out Handler
    const signOutBtn = document.querySelector('.sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            SafeYatraDB.logout();
        });
    }

    // Toast helper
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

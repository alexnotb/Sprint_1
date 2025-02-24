async function loadProfileImage() {
    try {
        const response = await fetch('/profile-image');
        if (response.ok) {
            const data = await response.json();
            return data.imagePath;
        }
    } catch (error) {
        console.error('Error loading profile image:', error);
        return null;
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        const accountControls = document.querySelector('.account-controls');
        
        if (data.loggedIn) {
            const imagePath = await loadProfileImage();
            const imageHtml = imagePath ? 
                `<img src="${imagePath}" alt="Profile" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;">` :
                `<span style="color: var(--very-light-beige); font-size: 24px;">+</span>`;

            accountControls.innerHTML = `
                <button type="button" onclick="location.href='/account';" 
                        style="background: none; border: none; cursor: pointer;">
                    <div class="profile-icon" style="width: 40px; height: 40px; margin: 0;">
                        ${imageHtml}
                    </div>
                </button>
            `;
        } else {
            accountControls.innerHTML = `
                <button type="button" onclick="location.href='/login';">LOGIN</button>
                <button type="button" onclick="location.href='/singup';">SIGNIN</button>
            `;
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Initialize auth status check when script loads
document.addEventListener('DOMContentLoaded', checkAuthStatus);

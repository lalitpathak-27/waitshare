const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const balanceEl = document.getElementById("balance");
const eventsEl = document.getElementById("events");
const noticeEl = document.getElementById("notice");
const withdrawAmountEl = document.getElementById("withdrawAmount");
const withdrawInrEl = document.getElementById("withdrawInr");
const withdrawButton = document.getElementById("withdrawButton");
const withdrawNotice = document.getElementById("withdrawNotice");
const withdrawEligibility = document.getElementById("withdrawEligibility");
const withdrawalsEl = document.getElementById("withdrawals");
let currentDashboard = null;

function showDashboard() {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadDashboard();
}

document.getElementById("demoLogin").addEventListener("click", showDashboard);
document.getElementById("signOut").addEventListener("click", () => {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll("[data-provider]").forEach(button => {
    button.addEventListener("click", () => {
        document.getElementById("loginNotice").textContent =
            button.dataset.provider + " login is a UI preview. Use demo login to enter.";
    });
});

function formatUSD(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD"
    }).format(Number(value || 0));
}

function formatINR(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(Number(value || 0));
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function updateWithdrawalPreview() {
    const amount = Number(withdrawAmountEl.value || 0);
    const rate = currentDashboard?.demo_exchange_rate || 85;
    withdrawInrEl.textContent = formatINR(Math.max(0, amount) * rate);
}

function renderWithdrawals(items) {
    if (!items || items.length === 0) {
        withdrawalsEl.innerHTML = "<p>No withdrawal requests yet.</p>";
        return;
    }
    withdrawalsEl.innerHTML = items.map(item => `
        <div class="withdraw-row">
            <div><strong>${formatUSD(item.amount_usd)}</strong><small>${escapeHTML(item.reference)}</small></div>
            <div class="withdraw-row-right"><strong>${formatINR(item.amount_inr)}</strong><small>SIMULATED · NOT PAID</small></div>
        </div>
    `).join("");
}

async function loadDashboard() {
    try {
        const response = await fetch("/api/dashboard");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load dashboard");
        currentDashboard = data;

        balanceEl.textContent = formatUSD(data.balance_usd);
        document.getElementById("inrEstimate").textContent =
            `Approx. ${formatINR(data.estimated_balance_inr)} · Demo estimate only`;

        eventsEl.innerHTML = data.events.map(event => {
            const amount = Number(event.amount);
            return `<div class="event-row">
                <span>${escapeHTML(event.event_type.replaceAll("_", " "))}</span>
                <b class="${amount < 0 ? "negative" : "positive"}">${amount > 0 ? "+" : ""}${formatUSD(amount)}</b>
            </div>`;
        }).join("") || "<p>No activity yet.</p>";

        withdrawEligibility.textContent = data.eligible
            ? "Eligible: your demo balance meets the $10 minimum."
            : `You need ${formatUSD(data.minimum_withdrawal_usd - data.balance_usd)} more to reach the $10 minimum.`;
        withdrawButton.disabled = !data.eligible;
        withdrawAmountEl.max = data.balance_usd.toFixed(2);
        updateWithdrawalPreview();
        renderWithdrawals(data.withdrawals);
    } catch (error) {
        eventsEl.textContent = "Could not load activity. Check whether Flask is running.";
        withdrawEligibility.textContent = "Wallet status unavailable.";
    }
}

withdrawAmountEl.addEventListener("input", updateWithdrawalPreview);

withdrawButton.addEventListener("click", async () => {
    const amount = Number(withdrawAmountEl.value);
    if (!Number.isFinite(amount) || amount < 10) {
        withdrawNotice.textContent = "The minimum demo withdrawal is $10.00.";
        return;
    }
    if (!currentDashboard || amount > currentDashboard.balance_usd) {
        withdrawNotice.textContent = "The requested amount exceeds your available demo balance.";
        return;
    }

    withdrawButton.disabled = true;
    withdrawNotice.textContent = "Submitting demo withdrawal…";
    try {
        const response = await fetch("/api/withdrawals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount_usd: amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Withdrawal request failed.");
        withdrawNotice.textContent = `${data.message} Reference: ${data.reference} · ${formatINR(data.amount_inr)} estimated.`;
        await loadDashboard();
    } catch (error) {
        withdrawNotice.textContent = error.message;
    } finally {
        withdrawButton.disabled = !currentDashboard?.eligible;
    }
});

document.getElementById("simulate").addEventListener("click", async () => {
    const button = document.getElementById("simulate");
    button.disabled = true;
    try {
        const response = await fetch("/api/demo-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seconds: 10 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not add demo activity.");
        noticeEl.textContent = data.message;
        await loadDashboard();
    } catch (error) {
        noticeEl.textContent = error.message || "Could not connect to Flask.";
    } finally {
        button.disabled = false;
    }
});

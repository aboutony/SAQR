// ============================================
// SAQR — WorkflowManager
// Remediation Ticket State Machine
// DETECTED → ASSIGNED → ACKNOWLEDGED → REMEDIATING → VERIFIED → CLOSED
// ============================================

const WorkflowManager = (() => {
    'use strict';

    // -----------------------------------------------
    // State Machine Definition
    // -----------------------------------------------
    const STATES = {
        DETECTED: { order: 0, label: 'Detected', label_ar: 'تم الكشف', color: '#EF4444', icon: '🔴', next: 'ASSIGNED' },
        ASSIGNED: { order: 1, label: 'Assigned', label_ar: 'تم التعيين', color: '#F59E0B', icon: '📋', next: 'ACKNOWLEDGED' },
        ACKNOWLEDGED: { order: 2, label: 'Acknowledged', label_ar: 'تم الإقرار', color: '#F59E0B', icon: '👁️', next: 'REMEDIATING' },
        REMEDIATING: { order: 3, label: 'Remediating', label_ar: 'قيد المعالجة', color: '#3B82F6', icon: '🔧', next: 'VERIFIED' },
        VERIFIED: { order: 4, label: 'Verified', label_ar: 'تم التحقق', color: '#00E5A0', icon: '✅', next: 'CLOSED' },
        CLOSED: { order: 5, label: 'Closed', label_ar: 'مغلق', color: '#6B7280', icon: '🔒', next: null },
    };

    // SLA targets per severity (in minutes)
    const SLA_TARGETS = {
        critical: 60,   // 1 hour
        high: 240,  // 4 hours
        medium: 1440, // 24 hours
    };

    // Ticket store
    let _tickets = [];
    let _ticketIdCounter = 1000;
    let _listeners = [];

    // -----------------------------------------------
    // Ticket Factory
    // -----------------------------------------------
    function createTicket(violation) {
        const ticketId = `RMD-${++_ticketIdCounter}`;
        const slaMinutes = SLA_TARGETS[violation.severity] || SLA_TARGETS.medium;

        const ticket = {
            id: ticketId,
            violationId: violation.id,
            violationCode: violation.code || '—',
            title: violation.title || 'Untitled Violation',
            authority: violation.authority || '—',
            severity: violation.severity || 'medium',
            state: 'DETECTED',
            stateHistory: [
                { state: 'DETECTED', at: new Date().toISOString(), by: 'SAQR Engine' }
            ],
            createdAt: new Date().toISOString(),
            sla: {
                targetMinutes: slaMinutes,
                deadlineAt: new Date(Date.now() + slaMinutes * 60000).toISOString(),
            },
            assignee: null,
            cdcVerified: false,
            reasoning: violation.reasoning || null,
        };

        _tickets.unshift(ticket);
        _emit('ticket:created', ticket);
        _emit('tickets:changed', _tickets);

        console.log(`[Workflow] Ticket ${ticketId} created → ${ticket.title} [${ticket.state}]`);
        return ticket;
    }

    // -----------------------------------------------
    // State Transitions
    // -----------------------------------------------
    function transition(ticketId, targetState, opts = {}) {
        const ticket = _tickets.find(t => t.id === ticketId);
        if (!ticket) throw new Error(`[Workflow] Ticket not found: ${ticketId}`);

        const currentDef = STATES[ticket.state];
        if (!currentDef) throw new Error(`[Workflow] Invalid current state: ${ticket.state}`);

        // Enforce linear state machine — only allow next state
        if (currentDef.next !== targetState) {
            throw new Error(`[Workflow] Invalid transition: ${ticket.state} → ${targetState}. Expected → ${currentDef.next}`);
        }

        // VERIFIED gate: CDC Mirror must confirm data matches
        if (targetState === 'VERIFIED' && !ticket.cdcVerified) {
            console.warn(`[Workflow] ⛔ Cannot verify ${ticketId} — CDC Mirror has not confirmed data match`);
            return false;
        }

        const prevState = ticket.state;
        ticket.state = targetState;
        ticket.stateHistory.push({
            state: targetState,
            at: new Date().toISOString(),
            by: opts.by || 'System',
        });

        if (targetState === 'ASSIGNED') {
            ticket.assignee = opts.assignee || 'Compliance Officer';
        }

        _emit('ticket:transitioned', { ticket, from: prevState, to: targetState });
        _emit('tickets:changed', _tickets);

        console.log(`[Workflow] ${ticketId}: ${prevState} → ${targetState}`);
        return true;
    }

    // -----------------------------------------------
    // CDC Verification
    // -----------------------------------------------
    function cdcVerify(ticketId) {
        const ticket = _tickets.find(t => t.id === ticketId);
        if (!ticket) return false;

        ticket.cdcVerified = true;
        ticket.cdcVerifiedAt = new Date().toISOString();

        _emit('ticket:cdcVerified', ticket);
        console.log(`[Workflow] ${ticketId}: CDC Mirror confirmed — data matches regulatory constraint`);
        return true;
    }

    // -----------------------------------------------
    // MTTR Calculation
    // -----------------------------------------------
    function getMTTR(ticket) {
        if (!ticket) return null;

        const deadline = new Date(ticket.sla.deadlineAt).getTime();
        const now = Date.now();
        const remainingMs = deadline - now;

        const totalMs = ticket.sla.targetMinutes * 60000;
        const elapsedMs = totalMs - remainingMs;

        return {
            remainingMs: Math.max(0, remainingMs),
            elapsedMs: Math.max(0, elapsedMs),
            totalMs,
            percentage: Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)),
            isOverdue: remainingMs <= 0,
            isCritical: remainingMs > 0 && remainingMs < totalMs * 0.25,
            formatted: _formatCountdown(remainingMs),
        };
    }

    function _formatCountdown(ms) {
        if (ms <= 0) return 'OVERDUE';
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
        return `${m}m ${String(s).padStart(2, '0')}s`;
    }

    // -----------------------------------------------
    // Queries
    // -----------------------------------------------
    function getTickets() { return [..._tickets]; }

    function getActiveTickets() {
        return _tickets.filter(t => t.state !== 'CLOSED');
    }

    function getTicketById(id) {
        return _tickets.find(t => t.id === id) || null;
    }

    function getStateDef(state) {
        return STATES[state] || null;
    }

    function getAllStates() {
        return { ...STATES };
    }

    // -----------------------------------------------
    // Event System
    // -----------------------------------------------
    function on(event, fn) {
        _listeners.push({ event, fn });
    }

    function _emit(event, data) {
        _listeners.filter(l => l.event === event).forEach(l => l.fn(data));
    }

    // -----------------------------------------------
    // Demo: Auto-advance a ticket through lifecycle
    // -----------------------------------------------
    function demoAdvance(ticketId, intervalMs = 3000) {
        const ticket = _tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        const advanceSteps = [
            { state: 'ASSIGNED', delay: intervalMs, opts: { assignee: 'Ahmad K. — Compliance Lead', by: 'Auto-Router' } },
            { state: 'ACKNOWLEDGED', delay: intervalMs * 2, opts: { by: 'Ahmad K.' } },
            { state: 'REMEDIATING', delay: intervalMs * 3, opts: { by: 'Ahmad K.' } },
            // CDC verify happens before VERIFIED
            { state: '_CDC_VERIFY', delay: intervalMs * 4 },
            { state: 'VERIFIED', delay: intervalMs * 4.5, opts: { by: 'CDC Mirror' } },
            { state: 'CLOSED', delay: intervalMs * 5.5, opts: { by: 'Audit Engine' } },
        ];

        advanceSteps.forEach(step => {
            setTimeout(() => {
                try {
                    if (step.state === '_CDC_VERIFY') {
                        cdcVerify(ticketId);
                    } else {
                        transition(ticketId, step.state, step.opts);
                    }
                } catch (e) {
                    console.warn(`[Workflow Demo] ${e.message}`);
                }
            }, step.delay);
        });

        console.log(`[Workflow] Demo advance started for ${ticketId} — 6 stages over ${(intervalMs * 5.5 / 1000).toFixed(0)}s`);
    }

    // -----------------------------------------------
    // Public API
    // -----------------------------------------------
    return {
        createTicket,
        transition,
        cdcVerify,
        getMTTR,
        getTickets,
        getActiveTickets,
        getTicketById,
        getStateDef,
        getAllStates,
        on,
        demoAdvance,
        STATES,
    };
})();

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkflowManager;
}

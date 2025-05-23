// #[allow(unused_use)]
module stillflow::vesting {
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin, value};
    use sui::balance::{Self, Balance};


    // ----------------------------------------------------------------------------
    // This module provides **Liquidity Lock** and **Token Vesting** primitives for
    // the Sui ecosystem.  Projects can escrow LP tokens or founder allocations in
    // on‑chain objects that only release after a time threshold.
    // ----------------------------------------------------------------------------

    /// ----------------------------- Error codes -----------------------------
    const ENOT_OWNER: u64          = 0;
    const ECLIFF_NOT_REACHED: u64  = 1;
    const ENOTHING_TO_CLAIM: u64   = 2;
    const EINVALID_DURATION: u64   = 3;
    const EINVALID_CLIFF: u64      = 4;
    const EINVALID_START: u64      = 5;


    /* ------------------------------------------------------------------------- */
    /*                                REGISTRY                                    */
    /* ------------------------------------------------------------------------- */

    /// Global registry that stores all locks & vesting schedules via dynamic‑fields.
    public struct Registry<phantom T> has key {
        id: UID,
        counter: u64,
        locks: Table<u64, Lock<T>>,
        vests: Table<u64, Vesting<T>>,
    }

    /// Capability handed to the creator so only they (or a delegate) can unlock.
    public struct LockerCap has key {
        id: UID,
        lock_id: u64,
        owner: address,
    }

    /* ------------------------------------------------------------------------- */
    /*                               LOCK OBJECT                                  */
    /* ------------------------------------------------------------------------- */

    public struct Lock<phantom T> has key, store {
        id: UID,
        depositor: address,
        amount: u64,
        unlock_ms: u64,
        balance: Balance<T>,
    }

    /* ------------------------------------------------------------------------- */
    /*                             VESTING OBJECT                                 */
    /* ------------------------------------------------------------------------- */

    public struct Vesting<phantom T> has key, store {
        id: UID,
        beneficiary: address,
        start_ms: u64,
        cliff_ms: u64,
        duration_ms: u64,
        total: u64,
        claimed: u64,
        balance: Balance<T>,
    }

    public struct VestingCap has key {
        id: UID,
        vest_id: u64,
    }

    /* ------------------------------------------------------------------------- */
    /*                           INITIALISATION                                   */
    /* ------------------------------------------------------------------------- */

    public fun init_registry<T>(ctx: &mut TxContext): Registry<T> {
        Registry {
            id: object::new(ctx),
            counter: 0,
            locks: table::new<u64, Lock<T>>(ctx),
            vests: table::new<u64, Vesting<T>>(ctx),
        }
    }

    /* ------------------------------------------------------------------------- */
    /*                         LIQUIDITY LOCK API                                 */
    /* ------------------------------------------------------------------------- */

    public fun create_lock<T>(
        reg: &mut Registry<T>,
        lp: Coin<T>,
        unlock_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): (u64, LockerCap) {
        // Require future unlock date
        assert!(unlock_ms > clock::timestamp_ms(clock), 0);

        // Autoincrement id
        let id = reg.counter;
        reg.counter = id + 1;

        let amount = value(&lp);
        let balance = coin::into_balance(lp);

        // Move coins into the Lock object
        let lock = Lock<T> {
            id: object::new(ctx),
            depositor: tx_context::sender(ctx),
            amount,
            unlock_ms,
            balance,
        };
        table::add(&mut reg.locks, id, lock);

        // Mint capability for the caller
        let cap = LockerCap { id: object::new(ctx), lock_id: id, owner: tx_context::sender(ctx) };
        (id, cap)
    }

    /// Withdraw coins after the unlock time has passed
    public fun withdraw_lock<T>(
        reg: &mut Registry<T>,
        id: u64,
        cap: &LockerCap,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        // Auth checks
        assert!(cap.owner == tx_context::sender(ctx), 1);
        assert!(cap.lock_id == id, 2);

        let Lock { id: lock_id, depositor: _, amount: _, unlock_ms, balance } = table::remove(&mut reg.locks, id);
        assert!(clock::timestamp_ms(clock) >= unlock_ms, 3);
        object::delete(lock_id);
        
        coin::from_balance(balance, ctx)
    }

    /* ------------------------------------------------------------------------- */
    /*                         TOKEN VESTING API                                  */
    /*  (Minimal skeleton – implement linear claim logic as a stretch goal)       */
    /* ------------------------------------------------------------------------- */

    /// Create a new vesting schedule for a beneficiary
    /// @param reg - Registry to store the vesting schedule
    /// @param vault - Tokens to be vested
    /// @param beneficiary - Address that will receive the vested tokens
    /// @param start_ms - Timestamp when vesting begins
    /// @param cliff_ms - Timestamp when first tokens become available
    /// @param duration_ms - Total duration of the vesting period
    /// @return id - Unique identifier for the vesting schedule
    public fun create_vesting<T>(
        reg: &mut Registry<T>,
        vault: Coin<T>,
        beneficiary: address,
        start_ms: u64,
        cliff_ms: u64,
        duration_ms: u64,
        ctx: &mut TxContext
    ): (u64, VestingCap) {
        assert!(duration_ms > 0, EINVALID_DURATION);
        assert!(cliff_ms >= start_ms, EINVALID_CLIFF);
        assert!(start_ms > 0, EINVALID_START);

        let id = reg.counter;
        reg.counter = id + 1;

        let total = value(&vault);
        let balance = coin::into_balance(vault);

        let vest = Vesting<T> {
            id: object::new(ctx),
            beneficiary,
            start_ms,
            cliff_ms,
            duration_ms,
            total,
            claimed: 0,
            balance,
        };
        table::add(&mut reg.vests, id, vest);
        
        // Create and return vesting capability
        let cap = VestingCap { 
            id: object::new(ctx), 
            vest_id: id 
        };
        
        (id, cap)
    }

    /// Calculate the amount of tokens that have vested at a given timestamp
    /// @param vest - The vesting schedule
    /// @param timestamp_ms - Current timestamp in milliseconds
    /// @return amount - Amount of tokens vested at the given timestamp
    public fun calculate_vested_amount<T>(
        vest: &Vesting<T>,
        timestamp_ms: u64
    ): u64 {
        // Before cliff, nothing is vested
        if (timestamp_ms < vest.cliff_ms) {
            return 0
        };
        
        // After vesting period ends, everything is vested
        if (timestamp_ms >= vest.start_ms + vest.duration_ms) {
            return vest.total
        };
        
        // During vesting period, calculate linear portion
        let elapsed = timestamp_ms - vest.start_ms;
        (vest.total * elapsed) / vest.duration_ms
    }

    /// Check how many tokens are available to claim
    /// @param vest - The vesting schedule
    /// @param timestamp_ms - Current timestamp in milliseconds
    /// @return amount - Amount of tokens available to claim
    public fun get_claimable_amount<T>(
        vest: &Vesting<T>,
        timestamp_ms: u64
    ): u64 {
        let vested_amount = calculate_vested_amount(vest, timestamp_ms);
        vested_amount - vest.claimed
    }

    /// Claim vested tokens
    /// @param reg - Registry containing the vesting schedule
    /// @param cap - Capability proving ownership of the vesting schedule
    /// @param clock - Clock object for timestamp verification
    /// @param ctx - Transaction context
    /// @return claimed_coins - Coins that have been claimed
    public fun claim_vested<T>(
        reg: &mut Registry<T>,
        cap: &VestingCap,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        // Get the vesting schedule
        let vest = table::borrow_mut(&mut reg.vests, cap.vest_id);
        
        // Ensure caller is beneficiary
        assert!(tx_context::sender(ctx) == vest.beneficiary, ENOT_OWNER);

        let now = clock::timestamp_ms(clock);
        assert!(now >= vest.cliff_ms, ECLIFF_NOT_REACHED);

        // Calculate vested amount
        let vested_amount = calculate_vested_amount(vest, now);
        let claimable = vested_amount - vest.claimed;
        
        assert!(claimable > 0, ENOTHING_TO_CLAIM);

        // Update claimed amount
        vest.claimed = vested_amount;

        // Extract the claimable amount
        let claim_balance = balance::split(&mut vest.balance, claimable);
        
        // Convert balance to coin and return
        coin::from_balance(claim_balance, ctx)
    }

    /// Check if vesting is complete
    /// @param reg - Registry containing the vesting schedule
    /// @param vest_id - ID of the vesting schedule
    /// @param clock - Clock object for timestamp verification
    /// @return is_complete - Whether vesting is complete
    public fun is_vesting_complete<T>(
        reg: &Registry<T>,
        vest_id: u64,
        clock: &Clock
    ): bool {
        let vest = table::borrow(&reg.vests, vest_id);
        let now = clock::timestamp_ms(clock);
        now >= vest.start_ms + vest.duration_ms && vest.claimed == vest.total
    }

    /// Get vesting schedule details
    /// @param reg - Registry containing the vesting schedule
    /// @param vest_id - ID of the vesting schedule
    /// @return (beneficiary, start_ms, cliff_ms, duration_ms, total, claimed)
    public fun get_vesting_details<T>(
        reg: &Registry<T>,
        vest_id: u64
    ): (address, u64, u64, u64, u64, u64) {
        let vest = table::borrow(&reg.vests, vest_id);
        (
            vest.beneficiary,
            vest.start_ms,
            vest.cliff_ms,
            vest.duration_ms,
            vest.total,
            vest.claimed
        )
    }
}

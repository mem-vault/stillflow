module stillflow::vault {

    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin, value};
    use sui::balance::Balance;
    use std::string::{Self, String};


    // ----------------------------------------------------------------------------
    // This module provides a simple **Token Lock** primitive for the Sui ecosystem.
    // Projects can lock tokens for a specific period of time, after which they
    // can be claimed by the beneficiary.
    // ----------------------------------------------------------------------------

    /// ----------------------------- Error codes -----------------------------
    #[allow(unused_const)]
    const ENOT_BENEFICIARY: u64     = 0;
    const ELOCK_NOT_EXPIRED: u64    = 1;
    const EINVALID_DURATION: u64    = 2;
    const EALREADY_CLAIMED: u64     = 3;

    /* ------------------------------------------------------------------------- */
    /*                                REGISTRY                                    */
    /* ------------------------------------------------------------------------- */

    /// Global registry that stores all token locks.
    public struct Registry has key, store {
        id: UID,
        name: String,
        description: String,
        counter: u64,
        locks: Table<u64, address>,
    }


    /* ------------------------------------------------------------------------- */
    /*                               LOCK OBJECT                                  */
    /* ------------------------------------------------------------------------- */

    public struct TokenLock<phantom T> has key, store {
        id: UID,
        creator: address,
        amount: u64,
        unlock_time: u64,  // Timestamp when tokens can be claimed
        balance: Balance<T>,
        is_claimed: bool,
    }

    /* ------------------------------------------------------------------------- */
    /*                           INITIALISATION                                   */
    /* ------------------------------------------------------------------------- */

    public fun init_registry(
        name: vector<u8>,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        let registry: Registry = Registry {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            counter: 0,
            locks: table::new<u64, address>(ctx),
        };
        transfer::share_object(registry);
    }

    /* ------------------------------------------------------------------------- */
    /*                         TOKEN LOCK API                                     */
    /* ------------------------------------------------------------------------- */

    public fun new_lock<T>(
        tokens: Coin<T>,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): TokenLock<T> {
        // Validate duration
        assert!(duration_ms > 0, EINVALID_DURATION);

        // Calculate unlock time
        let current_time = clock::timestamp_ms(clock);
        let unlock_time = current_time + duration_ms;

        let amount = value(&tokens);
        let balance = coin::into_balance(tokens);

        // Create the lock object
        TokenLock<T> {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            amount,
            unlock_time,
            balance,
            is_claimed: false,
        }
    }

    public fun transfer_lock<T>(lock: TokenLock<T>, beneficiary: address){
        transfer::public_transfer(lock, beneficiary);
    }

    /// Create a new token lock
    /// @param reg - Registry to store the lock
    /// @param tokens - Tokens to be locked
    /// @param beneficiary - Address that will receive the tokens after lock period
    /// @param duration_ms - Duration of the lock in milliseconds
    /// @param clock - Clock object for timestamp
    #[allow(lint(self_transfer))]
    public fun create_lock<T>(
        reg: &mut Registry,
        tokens: Coin<T>,
        beneficiary: address,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let lock = new_lock(tokens, duration_ms, clock, ctx);
        let lock_address = object::id(&lock).to_address();
        
        // Transfer lock to beneficiary
        transfer_lock(lock, beneficiary);

        // Add to registry
        table::add(&mut reg.locks, reg.counter, lock_address);

        reg.counter = reg.counter + 1;
    }

    /// Claim tokens after the lock period has expired
    /// @param lock - the lock whose tokens are to be claimed
    /// @param clock - Clock object for timestamp verification
    /// @param ctx - Transaction context
    /// @return Coin<T> - The unlocked tokens
    public fun claim_tokens<T>(
        lock: &mut TokenLock<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T>{
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= lock.unlock_time, ELOCK_NOT_EXPIRED);

        assert!(lock.is_claimed == false, EALREADY_CLAIMED);
        lock.is_claimed = true;

        let total_balance = lock.balance.value();
        coin::take(&mut lock.balance, total_balance, ctx)
    }

    /* ------------------------------------------------------------------------- */
    /*                           GETTER FUNCTIONS                                 */
    /* ------------------------------------------------------------------------- */

    /// Returns all lock IDs and their corresponding addresses in the registry
    /// @param reg - The registry to query
    /// @return vector<u64> - Vector of lock IDs
    /// @return vector<address> - Vector of lock addresses corresponding to the IDs
    public fun list_registry(reg: &Registry): (vector<u64>, vector<address>) {
        let mut lock_ids = vector::empty<u64>();
        let mut lock_addresses = vector::empty<address>();
        
        let mut i = 0;
        while (i < reg.counter) {
            if (table::contains(&reg.locks, i)) {
                vector::push_back(&mut lock_ids, i);
                vector::push_back(&mut lock_addresses, *table::borrow(&reg.locks, i));
            };
            i = i + 1;
        };
        
        (lock_ids, lock_addresses)
    }

    /// Check if a lock has expired
    /// @param clock - Clock object for timestamp verification
    /// @param lock - The lock to check
    /// @return bool - True if the lock has expired, false otherwise
    public fun is_lock_expired<T>(lock: &TokenLock<T>, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time >= lock.unlock_time
    }

    /// Get the remaining time for a lock
    /// @param lock - The lock to check
    /// @param clock - Clock object for timestamp verification
    /// @return u64 - Remaining time in milliseconds, 0 if expired
    public fun get_time_remaining<T>(lock: &TokenLock<T>, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock);
        if (current_time >= lock.unlock_time) {
            0
        } else {
            lock.unlock_time - current_time
        }
    }

    /// Get details about a lock
    /// @param lock - The lock to get details for
    /// @return address - Creator of the lock
    /// @return u64 - Amount of tokens locked
    /// @return u64 - Unlock time
    /// @return bool - Whether the lock has been claimed
    public fun get_lock_details<T>(lock: &TokenLock<T>): (address, u64, u64, bool) {
        (lock.creator, lock.amount, lock.unlock_time, lock.is_claimed)
    }

    /// Get registry details
    /// @param reg - The registry to query
    /// @return String - Name of the registry
    /// @return String - Description of the registry
    public fun get_registry_details(reg: &Registry): (String, String) {
        (reg.name, reg.description)
    }

    /// Get complete registry information
    /// @param reg - The registry to query
    /// @return String - Name of the registry
    /// @return String - Description of the registry
    /// @return u64 - Counter (number of locks created)
    /// @return vector<u64> - Vector of lock IDs
    /// @return vector<address> - Vector of lock addresses corresponding to the IDs
    public fun get_registry(reg: &Registry): (String, String, u64, vector<u64>, vector<address>) {
        let (lock_ids, lock_addresses) = list_registry(reg);
        (reg.name, reg.description, reg.counter, lock_ids, lock_addresses)
    }
    
}
#![no_std]
//! Maize warehouse-receipt contract.
//!
//! A receipt token represents a quantity of maize physically held by a
//! custodian (warehouse operator). The custodian mints a receipt on intake,
//! the receipt can be transferred between owners, and the custodian burns it
//! when the goods physically exit the warehouse (Exit event — issue #21).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Per-token metadata (custodian, quantity, etc.).
    TokenMeta(String),
    /// Current owner of a token.
    Owner(String),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TokenMetadata {
    /// The custodian that minted the receipt — the only address allowed to burn.
    pub custodian: Address,
    pub quantity_kg: u64,
    pub warehouse_id: String,
    pub grade: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    TokenAlreadyExists = 1,
    TokenNotFound = 2,
    Unauthorized = 3,
}

#[contract]
pub struct MaizeReceiptContract;

#[contractimpl]
impl MaizeReceiptContract {
    /// Custodian mints a new receipt token on warehouse intake.
    pub fn mint(
        env: Env,
        custodian: Address,
        token_id: String,
        owner: Address,
        quantity_kg: u64,
        warehouse_id: String,
        grade: String,
    ) -> Result<(), ContractError> {
        custodian.require_auth();

        let meta_key = DataKey::TokenMeta(token_id.clone());
        if env.storage().persistent().has(&meta_key) {
            return Err(ContractError::TokenAlreadyExists);
        }

        let metadata = TokenMetadata {
            custodian: custodian.clone(),
            quantity_kg,
            warehouse_id,
            grade,
        };
        env.storage().persistent().set(&meta_key, &metadata);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id.clone()), &owner);

        env.events()
            .publish((symbol_short!("Mint"), custodian), (token_id,));
        Ok(())
    }

    /// Transfer ownership of a receipt to a new owner (issue #9).
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: String,
    ) -> Result<(), ContractError> {
        from.require_auth();

        let owner_key = DataKey::Owner(token_id.clone());
        let current: Address = env
            .storage()
            .persistent()
            .get(&owner_key)
            .ok_or(ContractError::TokenNotFound)?;

        if current != from {
            return Err(ContractError::Unauthorized);
        }

        env.storage().persistent().set(&owner_key, &to);
        env.events()
            .publish((symbol_short!("Transfer"), from), (to, token_id));
        Ok(())
    }

    /// Custodian burns a receipt when goods physically exit the warehouse.
    ///
    /// Removes both the `TokenMeta` and `Owner` entries permanently and emits
    /// an `Exit` event. Only the original minting custodian may burn.
    pub fn burn(env: Env, custodian: Address, token_id: String) -> Result<(), ContractError> {
        // Caller must prove they are the custodian they claim to be.
        custodian.require_auth();

        // Token must exist.
        let meta_key = DataKey::TokenMeta(token_id.clone());
        let metadata: TokenMetadata = env
            .storage()
            .persistent()
            .get(&meta_key)
            .ok_or(ContractError::TokenNotFound)?;

        // Only the original minting custodian may burn.
        if metadata.custodian != custodian {
            return Err(ContractError::Unauthorized);
        }

        // Permanently remove both entries.
        env.storage().persistent().remove(&meta_key);
        env.storage()
            .persistent()
            .remove(&DataKey::Owner(token_id.clone()));

        // Emit Exit event.
        env.events().publish(
            (symbol_short!("Exit"), custodian.clone()),
            (token_id.clone(),),
        );

        Ok(())
    }

    /// Read a token's metadata (helper for clients / tests).
    pub fn metadata(env: Env, token_id: String) -> Result<TokenMetadata, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::TokenMeta(token_id))
            .ok_or(ContractError::TokenNotFound)
    }

    /// Read a token's current owner (helper for clients / tests).
    pub fn owner(env: Env, token_id: String) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .ok_or(ContractError::TokenNotFound)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup() -> (Env, Address, MaizeReceiptContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(MaizeReceiptContract, ());
        let client = MaizeReceiptContractClient::new(&env, &contract_id);
        (env, contract_id, client)
    }

    fn mint_one(env: &Env, client: &MaizeReceiptContractClient, custodian: &Address) -> String {
        let token_id = String::from_str(env, "KN-2026-000001");
        let owner = Address::generate(env);
        client.mint(
            custodian,
            &token_id,
            &owner,
            &1_000u64,
            &String::from_str(env, "WH-LAGOS-01"),
            &String::from_str(env, "Grade-A"),
        );
        token_id
    }

    /// mint then burn, assert token no longer in storage (both keys gone).
    #[test]
    fn test_burn_success() {
        let (env, contract_id, client) = setup();
        let custodian = Address::generate(&env);
        let token_id = mint_one(&env, &client, &custodian);

        client.burn(&custodian, &token_id);

        env.as_contract(&contract_id, || {
            assert!(!env
                .storage()
                .persistent()
                .has(&DataKey::TokenMeta(token_id.clone())));
            assert!(!env
                .storage()
                .persistent()
                .has(&DataKey::Owner(token_id.clone())));
        });
    }

    /// different custodian attempts burn, assert Unauthorized.
    #[test]
    fn test_burn_wrong_custodian() {
        let (env, _id, client) = setup();
        let custodian = Address::generate(&env);
        let attacker = Address::generate(&env);
        let token_id = mint_one(&env, &client, &custodian);

        let res = client.try_burn(&attacker, &token_id);
        assert_eq!(res, Err(Ok(ContractError::Unauthorized)));
    }

    /// burn non-existent token_id, assert TokenNotFound.
    #[test]
    fn test_burn_nonexistent_token() {
        let (env, _id, client) = setup();
        let custodian = Address::generate(&env);
        let token_id = String::from_str(&env, "DOES-NOT-EXIST");

        let res = client.try_burn(&custodian, &token_id);
        assert_eq!(res, Err(Ok(ContractError::TokenNotFound)));
    }
}

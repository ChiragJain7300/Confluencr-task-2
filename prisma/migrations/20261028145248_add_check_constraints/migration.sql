-- Add CHECK constraints for monetary integrity
ALTER TABLE "accounts" ADD CONSTRAINT "chk_accounts_balance_non_negative" CHECK ("balance" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transactions_amount_positive" CHECK ("amount" > 0);

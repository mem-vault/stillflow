"use client";

import { shortAddress } from '@/utils';
import styles from './lock-details.module.css'
import { Title, Flex, Button, SectionTitle, Actions, Container, ModalOverlay, ModalContent, Input } from '@/styled';
import { useState } from 'react';
import { useCurrentAccount, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID } from '@/constants';

export type TokenLock = Readonly<{
    id: string,
    token: "sui" | "usdc" | "usdt",
    amount: number,
    balance: number,
    owner: string,
    creator: string,
    isClaimed: boolean,
    isExpired: boolean,
    unlockTime: number,
}>;

export const LockDetails = ({
    lockDetail,
    title,
}: Readonly<{
    lockDetail: TokenLock | null;
    title?: string;
}>) => {
    const suiClient = useSuiClient();
    const currentAddress = useCurrentAccount()?.address;
    const { mutateAsync: signTx } = useSignTransaction();

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAddress, setTransferAddress] = useState<string>('');

    const handleClaim = async () => {
        if (!currentAddress) {
            alert('请先连接钱包');
            return;
        }
        if (!lockDetail) {
            console.error("Missing lock information");
            return;
        }
        const tx = new Transaction();
        tx.setGasBudget(10000000);
        const claimedTokens = tx.moveCall({
            target: `${PACKAGE_ID}::bank::claim_tokens`,
            arguments: [
                tx.object(lockDetail.id),
                tx.object("0x6")
            ],
            typeArguments: ["0x2::sui::SUI"]
        });
        tx.transferObjects([claimedTokens], currentAddress);
        const signedTx = await signTx({ transaction: tx });
        const claimResult = await suiClient.executeTransactionBlock({
            transactionBlock: signedTx.bytes,
            signature: signedTx.signature,
            options: {
                showEffects: true,
                showEvents: true,
            }
        });
        if (claimResult.effects?.status.status === "success") {
            alert("Claim transaction successful!");
        } else {
            console.error("Claim transaction failed:", claimResult.effects?.status.error);
            alert("Claim transaction failed");
        }
    }

    const handleTransfer = async () => {
        if (!currentAddress) {
            alert('请先连接钱包');
            return;
        }
        if (!lockDetail) {
            console.error("Missing registry object ID or lockCap");
            return;
        }

        console.log("Transfering lock", lockDetail.id, "to", transferAddress);
        const tx = new Transaction();
        tx.setGasBudget(10000000);
        tx.moveCall({
            target: `${PACKAGE_ID}::bank::transfer_lock`,
            arguments: [
                tx.object(lockDetail.id),
                tx.pure.address(transferAddress),
            ],
            typeArguments: ["0x2::sui::SUI"]
        });
        const signedTx = await signTx({ transaction: tx });
        const result = await suiClient.executeTransactionBlock({
            transactionBlock: signedTx.bytes,
            signature: signedTx.signature,
            options: {
                showEffects: true,
                showEvents: true,
            }
        });
        if (result.effects?.status.status === "success") {
            alert("Transfer transaction successful!");
        } else {
            console.error("Transfer transaction failed:", result.effects?.status.error);
            alert("Transfer transaction failed");
        }
    }

    return (
        <Container $grow={1} $gap={2} $direction="column"> {/* 主容器可以保持无边框 */}
            <SectionTitle>{title || "Lock Details"}</SectionTitle>
            <Container $gap={2} $direction='column' $grow={1} $bordered className={styles.descriptionBox}> {/* 应用 $bordered */}
                {lockDetail ? (
                    <Flex $gap="8px" $direction='column'> {/* 调整了间距 */}
                        <p>
                            <strong>ID:</strong>
                            <span>{shortAddress(lockDetail.id, 8, 8)}</span>
                        </p>
                        <p>
                            <strong>Token:</strong>
                            <span>SUI</span>
                        </p>
                        <p>
                            <strong>Quantity:</strong>
                            <span>{lockDetail.amount}</span>
                        </p>
                        <p>
                            <strong>Expires:</strong>
                            <span>{new Date(lockDetail.unlockTime).toLocaleString()}</span>
                        </p>
                        <p>
                            <strong>Expired:</strong>
                            <span>{lockDetail.isExpired ? 'Yes' : 'No'}</span>
                        </p>
                        <p>
                            <strong>Creator:</strong>
                            <span
                                className="copyable"
                                onClick={() => navigator.clipboard.writeText(lockDetail.creator)}
                            >{shortAddress(lockDetail.creator, 8, 8)}</span>
                        </p>
                        <p>
                            <strong>Owner:</strong>
                            <span
                                className="copyable"
                                onClick={() => navigator.clipboard.writeText(lockDetail.owner)}
                            >{shortAddress(lockDetail.owner, 8, 8)}</span>
                        </p>
                        <p>
                            <strong>Claimed:</strong>
                            <span>{lockDetail.isClaimed ? 'Yes' : 'No'}</span>
                        </p>
                    </Flex>
                ) : (
                    <Title>Select a lock to see details</Title>
                )}
            </Container>
            <Actions>
                <Button onClick={() => setIsTransferModalOpen(true)}>Transfer</Button>
                <Button onClick={handleClaim}>Withdraw</Button>
            </Actions>
            {isTransferModalOpen && (
                <ModalOverlay>
                    <ModalContent>
                        <h2>Transfer Lock</h2>
                        <Flex>
                            <div>
                                <label htmlFor="targetAddress">Recipient Address:</label>
                                <Input
                                    type="text"
                                    id="targetAddress"
                                    value={transferAddress}
                                    onChange={(e) => setTransferAddress(e.target.value)}
                                    required
                                />
                            </div>
                        </Flex>
                        <Actions>
                            <Button onClick={handleTransfer} $primary>Transfer</Button>
                            <Button onClick={() => setIsTransferModalOpen(false)}>Cancel</Button>
                        </Actions>
                    </ModalContent>
                </ModalOverlay>
            )}
        </Container>
    )
}
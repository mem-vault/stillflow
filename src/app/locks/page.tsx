"use client"

import { useCallback, useEffect, useState } from 'react'
import styles from './locks.module.css'
import { PACKAGE_ID, REFRESH_RATE } from '@/constants'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { Container, Flex, LockItem, Title } from '@/styled'
import { shortAddress } from '@/utils'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { LockDetails, TokenLock } from '@/components/LockDetails/lock-details'

export default function LocksPage() {
    const suiClient = useSuiClient();
    const currentAddress = useCurrentAccount()?.address;
    const [locks, setLocks] = useState<TokenLock[]>([]);
    const [selectedLock, setSelectedLock] = useState<TokenLock | null>(null);
    const [loading, setLoading] = useState(true);

    const loadLocks = useCallback(async () => {
        if (!currentAddress) {
            return;
        }
        const res = await suiClient.getOwnedObjects({
            owner: currentAddress,
            filter: {
                StructType: `${PACKAGE_ID}::bank::TokenLock<0x2::sui::SUI>`,
            },
            options: {
                showContent: true,
            }
        });
        setLocks(await Promise.all(res.data.map(async (obj): Promise<TokenLock> => {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::bank::is_lock_expired`,
                arguments: [
                    tx.object(obj.data!.objectId),
                    tx.object("0x6")
                ],
                typeArguments: ["0x2::sui::SUI"],
            })
            const isExpired = await suiClient.devInspectTransactionBlock({
                transactionBlock: tx,
                sender: currentAddress,
            });
            const fields = (obj.data?.content as unknown as {
                fields: {
                    amount: string,
                    balance: string,
                    creator: string,
                    is_claimed: boolean,
                    unlock_time: string,
                }
            }).fields;
            return {
                id: obj.data!.objectId,
                token: "sui",
                amount: Number(fields.amount),
                balance: Number(fields.balance),
                creator: fields.creator,
                owner: currentAddress,
                isClaimed: fields.is_claimed,
                isExpired: bcs.bool().parse(Uint8Array.from(isExpired.results![0].returnValues![0][0])),
                unlockTime: Number(fields.unlock_time),
            };
        })));
        setLoading(false);
    }, [currentAddress, suiClient]);

    useEffect(() => {
        setLoading(true);
        loadLocks();
        const interval = setInterval(loadLocks, REFRESH_RATE);
        return () => clearInterval(interval);
    }, [loadLocks]);

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <Title>My Locks</Title>
                </div>
                <Flex $gap={2} $direction='row' style={{ width: '100%' }}>
                    <Container $bordered style={{ flex: '0 0 250px', maxHeight: '500px', overflowY: 'auto' }}>
                        {loading ? (
                            <p className={styles.loadingText}>Loading...</p>
                        ) : locks.length > 0 ? (
                            <Flex $gap="0.5rem" $direction='column'>
                                {locks.map(lock => {
                                    return (
                                        <LockItem key={lock.id} onClick={() => setSelectedLock(lock)}>
                                            <span>{shortAddress(lock.id, 4, 4)}</span>
                                            <span>{`${lock.amount} MIST`}</span>
                                        </LockItem>
                                    )
                                })}
                            </Flex>
                        ) : (
                            <p className={styles.noLocksText}>No locks found</p>
                        )}
                    </Container>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <LockDetails lockDetail={selectedLock} />
                    </div>
                </Flex>
            </div>
        </main>
    );
}
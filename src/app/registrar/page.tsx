'use client'; // 需要 'use client' 因为我们使用了 useState 和事件处理

import React, { useState, FormEvent, useEffect, useCallback } from 'react';
import styles from './registrar.module.css';
import Link from 'next/link';
import { CREATED_REGISTRIES, PACKAGE_ID, REFRESH_RATE, REGISTRIES } from '@/constants';
import { ConnectModal, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from '@mysten/sui/bcs';
import { Address } from '@/utils';

interface LockModule {
    slug: string;
    title: string;
    description: string;
    lockCount: string;
    large?: boolean;
}

// const initialModules: LockModule[] = [
//     { slug: 'travel-fund', title: '存钱去旅游', description: 'discription', lockCount: '21locks' },
//     { slug: 'education-fund', title: '存钱去深造', description: 'discription', lockCount: '10locks' },
//     { slug: 'startup-fund', title: '存钱去创业', description: 'discription', lockCount: '5locks' },
//     { slug: 'sui-foundation', title: 'sui foundation', description: 'discription', lockCount: '5locks' },
//     { slug: 'suilend-foundation', title: 'suilend foundation', description: 'discription', lockCount: '6locks', large: true },
// ];

export default function RegistrarPage() {
    const [open, setOpen] = useState(false);

    const [modules, setModules] = useState<LockModule[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newModuleName, setNewModuleName] = useState('');
    const [unlockTime, setUnlockTime] = useState(new Date());
    const [newModuleDescription, setNewModuleDescription] = useState('');
    const [newModuleBeneficiary, setNewModuleBeneficiary] = useState('');
    const suiClient = useSuiClient();
    const { mutateAsync: execute } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await suiClient.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showEffects: true,
                }
            })
    });
    const currentAccount = useCurrentAccount();
    const utf8Encoder = new TextEncoder();

    const loadModules = useCallback(async () => {
        if (!currentAccount) {
            return;
        }
        const data = await Promise.all(new Set([
            ...REGISTRIES,
            ...JSON.parse(localStorage.getItem(CREATED_REGISTRIES) || '[]')
        ]).values().map(async (registryId) => {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::bank::get_registry`,
                arguments: [
                    tx.object(registryId)
                ]
            });
            const result = await suiClient.devInspectTransactionBlock({
                transactionBlock: tx,
                sender: currentAccount.address
            });
            const returnValues = result.results![0].returnValues!;

            return {
                registryObjectId: registryId,
                name: bcs.string().parse(Uint8Array.from(returnValues[0][0])),
                description: bcs.string().parse(Uint8Array.from(returnValues[1][0])),
                unlockTime: bcs.u64().parse(Uint8Array.from(returnValues[2][0])),
                lockCount: bcs.u64().parse(Uint8Array.from(returnValues[3][0])),
                beneficiary: Address.parse(Uint8Array.from(returnValues[6][0]))
            };
        }));
        setModules(data.map(item => {
            return {
                slug: item.registryObjectId,
                title: item.name,
                description: item.description,
                lockCount: `${item.lockCount} locks`,
            };
        }));
    }, [currentAccount, suiClient]);

    useEffect(() => {
        loadModules();
        const intervalId = setInterval(loadModules, REFRESH_RATE);
        return () => clearInterval(intervalId);
    }, [loadModules]);

    const handleOpenModal = async () => {
        setNewModuleBeneficiary(currentAccount?.address || '');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        // setNewModuleName('');
        // setNewModuleDescription('');
    };

    const handleSubmitNewModule = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newModuleName.trim()) {
            alert('模块名称不能为空');
            return;
        }
        // const slug = newModuleName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        // const newModule: LockModule = {
        //     slug: slug || `module-${Date.now()}`, // 确保 slug 不为空
        //     title: newModuleName,
        //     description: newModuleDescription,
        //     lockCount: '0locks', // 新模块初始 lock 数量为 0
        // };
        // setModules([...modules, newModule]);
        try {
            if (!currentAccount) {
                alert('请先连接钱包');
                return;
            }
            const tx = new Transaction();
            tx.setGasBudget(10000000);
            tx.moveCall({
                target: `${PACKAGE_ID}::bank::init_registry`,
                arguments: [
                    tx.pure.vector("u8", utf8Encoder.encode(newModuleName)),
                    tx.pure.vector("u8", utf8Encoder.encode(newModuleDescription)),
                    tx.pure.u64(unlockTime.getTime()),
                    tx.pure.address(newModuleBeneficiary),
                    tx.object("0x6"),
                ]
            });
            const result = await execute({ transaction: tx, account: currentAccount });

            if (result.effects?.status.status === "success") {
                console.log("Transaction executed successfully:", result);
                const createdRegistryId = result.effects?.created![0].reference.objectId;
                const createdRegistries: string[] = JSON.parse(localStorage.getItem(CREATED_REGISTRIES) || '[]');
                localStorage.setItem(CREATED_REGISTRIES, JSON.stringify([...createdRegistries, createdRegistryId]));
            } else {
                console.error("Transaction execution failed. Status:", result.effects?.status);
                // 打印更详细的错误信息
                if (result.effects?.status.error) {
                    console.error("Error details:", result.effects.status.error);
                }
            }
        } catch (error) {
            console.error("Error creating registry:", error);
        }
        handleCloseModal();
    };

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <h1 className={styles.title}>StillFlow</h1>
                <p className={styles.welcomeText}>Welcome to StillFlow</p>
                <div className={styles.actionsContainer}>
                    {currentAccount == null ? (
                        <ConnectModal
                            trigger={
                                <button className={styles.actionButton}>Connect wallet to start</button>
                            }
                            open={open}
                            onOpenChange={(isOpen) => setOpen(isOpen)}
                        />
                    ) : (
                        <button className={styles.actionButton} onClick={handleOpenModal} disabled={!currentAccount}>
                            + Create New Goal
                        </button>
                    )}
                </div>
                <div className={styles.locksGrid}>
                    {modules.map((module) => (
                        <Link href={`/lock/${module.slug}`} passHref className={styles.lockItemLink} key={module.slug}>
                            <div className={`${styles.lockItem} ${module.large ? styles.largeLockItem : ''}`}>
                                <p className={styles.lockTitle}>{module.title}</p>
                                <p className={styles.lockDescription}>{module.description}</p>
                                <p className={styles.lockCount}>{module.lockCount}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <h2>Create New Goal</h2>
                        <form onSubmit={handleSubmitNewModule}>
                            <div className={styles.formGroup}>
                                <label htmlFor="moduleName">Goal Name:</label>
                                <input
                                    type="text"
                                    id="moduleName"
                                    value={newModuleName}
                                    onChange={(e) => setNewModuleName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="moduleDescription">Goal Details:</label>
                                <textarea
                                    id="moduleDescription"
                                    value={newModuleDescription}
                                    onChange={(e) => setNewModuleDescription(e.target.value)}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="moduleBeneficiary">Beneficiary:</label>
                                <input
                                    type="text"
                                    id="moduleBeneficiary"
                                    value={newModuleBeneficiary}
                                    onChange={(e) => setNewModuleBeneficiary(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="unlockTime">Unlock Time:</label>
                                <input
                                    type="datetime-local"
                                    id="unlockTime"
                                    value={(unlockTime || '').toISOString().substring(0, 16)}
                                    onChange={(e) => {
                                        if (!e.target.validity.valid) return;
                                        console.log(e.target.value);
                                        setUnlockTime(new Date(`${e.target.value}:00Z`))
                                    }}
                                    required
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="submit" className={styles.modalButton}>Create</button>
                                <button type="button" className={styles.modalButton} onClick={handleCloseModal}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
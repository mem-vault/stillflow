import styles from './page.module.css';
import Link from 'next/link';
import Image from 'next/image'; // 导入 Image 组件

export default function HomePage() {
  return (
    <main className={styles.main}>
      <div className={styles.outerContainer}>
        {/* 将 <img> 替换为 <Image /> */}
        <Image
          src="/logo.png" // public 目录下的图片路径
          alt="StillFlow Vault Logo"
          className={styles.logo}
          width={150} // 提供图片的宽度
          height={150} // 提供图片的高度 (请根据您的 logo.png 实际宽高比调整)
          priority // 如果是 LCP 元素，可以添加 priority 属性
        />
        <p className={styles.mainText}>
          Stillflow is a protocol that truly implements public ledgers
        </p>
        <Link href="/registrar" passHref>
          <button className={styles.launchButton}>
            Launch APP
          </button>
        </Link>
      </div>
    </main>
  );
}
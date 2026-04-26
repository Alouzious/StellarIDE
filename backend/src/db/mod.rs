use sqlx::PgPool;
use tokio::time::{sleep, Duration};

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    let mut last_error = None;
    for _ in 0..15 {
        match PgPool::connect(database_url).await {
            Ok(pool) => return Ok(pool),
            Err(err) => {
                last_error = Some(err);
                sleep(Duration::from_secs(2)).await;
            }
        }
    }
    Err(last_error
        .expect("retry loop should capture at least one connection error")
        .into())
}

pub async fn migrate(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

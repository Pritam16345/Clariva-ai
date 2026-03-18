# migrate.py — Auto-migration script for Supabase / PostgreSQL schemas

from database import engine
from models import Base

def run_migration():
    print("Running database migrations...")
    Base.metadata.create_all(bind=engine)
    print("✅ Successfully applied all database schemas.")

if __name__ == "__main__":
    run_migration()

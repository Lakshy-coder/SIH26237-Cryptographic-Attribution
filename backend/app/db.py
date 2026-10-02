import os
from sqlalchemy import create_engine, Column, Integer, String, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sihdb.sqlite")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Recipient(Base):
    __tablename__ = "recipients"
    id = Column(String, primary_key=True, index=True)
    ml_kem_public_key = Column(LargeBinary)
    ml_dsa_public_key = Column(LargeBinary)

class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, index=True)
    encrypted_payload = Column(LargeBinary)
    doc_hash = Column(String)

class Envelope(Base):
    __tablename__ = "envelopes"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String)
    recipient_id = Column(String)
    wrapped_dek = Column(LargeBinary)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

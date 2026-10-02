#!/usr/bin/env python3
import os
import sys

def main():
    print("Running E2E Demo...")
    os.system("docker compose run tests")
    
if __name__ == "__main__":
    main()

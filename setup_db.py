import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('cms_data.db')
cur = conn.cursor()

print('Setting up database...')

# Drop tables if they exist prior to running
cur.execute("DROP TABLE IF EXISTS hospital;")
cur.execute("DROP TABLE IF EXISTS infections;")
cur.execute("DROP TABLE IF EXISTS complications_and_deaths;")
cur.execute("DROP TABLE IF EXISTS unplanned_hospital_visits;")

# Create tables with data types
cur.execute('''CREATE TABLE hospital(
    Facility_ID TEXT PRIMARY KEY, 
    Facility_Name TEXT, 
    Address TEXT, 
    Town TEXT, 
    State TEXT, 
    ZIP TEXT, 
    County TEXT, 
    Telephone TEXT, 
    Type TEXT, 
    Ownership TEXT, 
    Emergency_Services TEXT, 
    Meets_BFD_Criteria TEXT, 
    Rating INTEGER
);''')

cur.execute('''CREATE TABLE infections(
    Facility_ID TEXT, 
    Measure_ID TEXT, 
    Measure_Name TEXT, 
    Compared_to_National TEXT, 
    Score REAL, 
    Start_Date TEXT, 
    End_Date TEXT
);''')

cur.execute('''CREATE TABLE complications_and_deaths(
    Facility_ID TEXT, 
    Measure_ID TEXT, 
    Measure_Name TEXT, 
    Compared_to_National TEXT, 
    Denominator INTEGER, 
    Score REAL, 
    Start_Date TEXT, 
    End_Date TEXT
);''')

cur.execute('''CREATE TABLE unplanned_hospital_visits(
    Facility_ID TEXT, 
    Measure_ID TEXT, 
    Measure_Name TEXT, 
    Compared_to_National TEXT, 
    Score REAL, 
    Number_Patients INTEGER, 
    Number_Patients_Returned INTEGER, 
    Start_Date TEXT, 
    End_Date TEXT
);''')

# Function to clean dataframe (AUTHORED BY AI)
def clean_df(df):
    # First strip whitespace from all string columns
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].str.strip() if df[col].dtype == 'object' else df[col]
    
    # Replace variations of "Not Available" (case-insensitive)
    df.replace(['Not Available', 'not available', 'NOT AVAILABLE', 'N/A', 'n/a', 'NA', 'na', ''], None, inplace=True)
    df.replace(np.nan, None, inplace=True)
    
    return df

# Hospital
print('Loading Hospital data...')
df = pd.read_csv('data/Hospital.csv')
df = clean_df(df)
df['Rating'] = pd.to_numeric(df['Rating'], errors='coerce')
df['ZIP'] = pd.to_numeric(df['ZIP'], errors='coerce')
df.to_sql('hospital', conn, if_exists='append', index=False)
print(f"Loaded {len(df)} hospital records")


# Infections
print('Loading Infection data...')
df = pd.read_csv('data/Infections.csv')
df = clean_df(df)
df['Score'] = pd.to_numeric(df['Score'], errors='coerce')
df.to_sql('infections', conn, if_exists='append', index=False)
print(f"Loaded {len(df)} infection records")


# Complications and Deaths
print('Loading Complications and Deaths data...')
df = pd.read_csv('data/Complications_and_Deaths.csv')
df = clean_df(df)
df['Denominator'] = pd.to_numeric(df['Denominator'], errors='coerce')
df['Score'] = pd.to_numeric(df['Score'], errors='coerce')
df.to_sql('complications_and_deaths', conn, if_exists='append', index=False)
print(f"Loaded {len(df)} complications & deaths records")


# Unplanned Hospital Visits
print('Loading Unplanned Hospital Visits data...')
df = pd.read_csv('data/Unplanned_Hospital_Visits.csv')
df = clean_df(df)
df['Score'] = pd.to_numeric(df['Score'], errors='coerce')
df['Number_Patients'] = pd.to_numeric(df['Number_Patients'], errors='coerce')
df['Number_Patients_Returned'] = pd.to_numeric(df['Number_Patients_Returned'], errors='coerce')
df.to_sql('unplanned_hospital_visits', conn, if_exists='append', index=False)
print(f"Loaded {len(df)} unplanned hospital visits records")


conn.commit()
conn.close()

print('Database successfully loaded in.')
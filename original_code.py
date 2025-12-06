import sqlite3

conn = sqlite3.connect('cms_data.db')
cur = conn.cursor()

# FUNCTIONS ----------------------------------------------
def get_choice(values):
    choice = input("=> ")
    while choice not in values:
        print("Invalid choice.")
        choice = input("=> ")
    return choice

def get_choice_largenum(num):
    while True:
        choice = input("=> ")
        try:
            choice = int(choice)
            if 1 <= choice <= num:
                return choice
            else:
                print("Invalid input. Number out of range.")
        except ValueError:
            print("Invalid input. Must be a number.")

def get_operation():
    print('Select an operation: ')
    print('1. Update')
    print('2. Delete')
    print('3. Query')
    print('4. Back to Tables')
    operation = get_choice(['1','2','3', '4'])
    return operation

def get_numeric_columns(table_name):
    # Get table info
    columns_info = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
    
    numeric_columns = []
    
    for col in columns_info:
        column_index = col[1]
        column_type = col[2].upper()
        
        # Check if the type is numeric
        if column_type in ['INTEGER', 'INT', 'REAL', 'FLOAT', 'DOUBLE', 'NUMERIC']:
            numeric_columns.append(column_index)
    
    return numeric_columns

def print_columns(table_name):
    # Display list of all column names, numbered
    print('Column names: ')
    columns_info = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
    column_names = [col[1] for col in columns_info]
    possible_choices = []
    for i, name in enumerate(column_names):
        print(f"{i+1}. {name}")
        possible_choices.append(str(i+1))
    return possible_choices, column_names

def update_table(table_name, type):
    possible_choices, column_names = print_columns(table_name)

    # Get user input for column name
    print('Select a column to change: ')
    column = get_choice(possible_choices)
    old_name = column_names[int(column)-1]

    # If they want to change COLUMN NAME:
    if type == '1':
        new_name = input(f"Enter the new name for '{old_name}': ")
        # Update DB table with new name
        cur.execute(f"ALTER TABLE {table_name} RENAME COLUMN {old_name} TO {new_name};")
        print('Success!')
        print_first_3(table_name)
        return
    
    
    # If they want to change ROW VALUE:
    row_count = cur.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    print(f'Input the number row to edit from 1 to {row_count}: ')
    row_number = get_choice_largenum(row_count)
    new_value = input(f'Enter the new value for {old_name} in row {row_number}: ')
    print(new_value)

    # WORKING!
    cur.execute(f"UPDATE {table_name} SET {old_name} = '{new_value}' WHERE ROWID = {row_number};")
    print_first_3(table_name)

    return

def delete(table_name, type):
    if (type == '1'):
        print('\nSelect a column to delete: ')
        possible_choices, column_names = print_columns(table_name)
        column = get_choice(possible_choices)
        if (column == '1'):
            print('Error! You cannot delete a Primary Key column.')
            return
        column_name = column_names[int(column)-1]
        # Execute SQL
        cur.execute(f"ALTER TABLE {table_name} DROP COLUMN {column_name};")
        print_first_3(table_name)

    else:
        row_count = cur.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        if (row_count <= 0):
            print('No rows to delete.')
            return
        print(f"\nEnter the row number to delete from 1 to {row_count}: ")
        row_number = get_choice_largenum(row_count)
        # Execute SQL
        cur.execute(f"DELETE FROM {table_name} WHERE ROWID = {row_number};")
        print_first_3(table_name)
    

    return

def select(table_name):
    # Get input for which columns to select
    possible_choices, column_names = print_columns(table_name)
    print('Input which columns you would like to select, separated by commas (no spaces).')
    print('Leave blank if you would like to select them all.')
    selection_str = input('=> ')


    # If blank (select all columns)
    if selection_str.strip() == '':
        columns = '*'
    else:
        # Turn input from string into iterable list
        selection = selection_str.split(',') # List of strings
        selected_columns = []

        # Map selection list to column names for the query
        for i, name in enumerate(possible_choices): # List of strings
            if (name in selection):
                selected_columns.append(column_names[i])
            
        columns = ''
        for col in selected_columns:
            if columns == '':
                columns += col
            else:
                columns += "," + col

    # Get other operations to perform
    other_queries = secondary_queries(table_name)

    # If no other queries, limit print to first 10 rows
    if other_queries == '':
        print(cur.execute(f"SELECT {columns} FROM {table_name} LIMIT 10;").fetchall())
    else:
        print(f"SELECT {columns} FROM {table_name} {other_queries};")
        result = cur.execute(f"SELECT {columns} FROM {table_name} {other_queries};").fetchall()


    # Pretty printing - AUTHORED BY AI
    column_names = [description[0] for description in cur.description]
    header = " | ".join(column_names)
    print(header)
    print("-" * len(header))
    for row in result:
        print(" | ".join(str(value) if value is not None else "NULL" for value in row))


    return

def where(table_name):
    # Where operators:
    # BETWEEN, LIKE, IN, =, <, >, <=, >=, !=

    # Get column for comparison
    possible_choices, column_names = print_columns(table_name)
    print('Choose a column for filtering.')
    column_num_str = get_choice(possible_choices)
    column_num = int(column_num_str)
    column = column_names[column_num - 1]

    # Get clause/operator
    num_to_name_map = {
        1: "BETWEEN",
        2: "LIKE",
        3: "IN",
        4: "=",
        5: "<",
        6: ">",
        7: "<=",
        8: ">=",
        9: "!="
    }
    print('1. BETWEEN')
    print('2. LIKE')
    print('3. IN')
    print('4. =')
    print('5. <')
    print('6. >')
    print('7. <=')
    print('8. >=')
    print('9. !=')
    print('Select a filtering method.')
    operator_choice = get_choice(['1','2','3','4','5','6','7','8','9'])
    operator = num_to_name_map[int(operator_choice)]

    # Get criteria field
    # if BETWEEN, get 2 fields
    if operator_choice == '1':
        print(f"{column} {operator} _____ AND _____")
        lower_limit = input('Enter lower limit: ')
        higher_limit = input('Enter higher limit: ')
        criteria = lower_limit + " AND " + higher_limit

    # if IN, get list of values
    elif operator_choice == '3':
        print('Enter values separated by commas (e.g., value1,value2,value3):')
        values = input(f"{column} {operator} ")
        # Split and quote each value
        value_list = values.split(',')
        quoted_values = []
        for v in value_list:
            stripped_value = v.strip()
            quoted_value = f"'{stripped_value}'"
            quoted_values.append(quoted_value)

        # Join with commas and wrap in parentheses
        joined_values = ','.join(quoted_values)
        criteria = f"({joined_values})"

    else:
        print('Enter your criteria:')
        criteria = input(f"{column} {operator} ")

        # Try to convert to number - if it fails, it's a string
        try:
            float(criteria)  # Test if it's numeric
            # It's a number, don't add quotes
        except ValueError:
            # It's a string, add quotes
            criteria = f"'{criteria}'"
           
    # LIKE - add wildcards if not already present
    if operator_choice == '2':
        if not criteria.startswith("'"):
            criteria = f"'%{criteria}%'"
        elif '%' not in criteria:
            # Remove existing quotes, add wildcards, re-quote
            criteria = f"'%{criteria.strip(chr(39))}%'"

    query = f'WHERE {column} {operator} {criteria}'
    return query

def order_by(table_name):
    # Get column to order by, and ASC or DESC
    possible_choices, column_names = print_columns(table_name)
    print('Choose a column to order by.')
    column_num_str = get_choice(possible_choices)
    column_num = int(column_num_str)
    column_name = column_names[column_num - 1]
    
    print('Select an order: ')
    print('1. Ascending')
    print('2. Descending')
    order = get_choice(['1','2'])

    if order == '1':
        query = "ORDER BY " + column_name
    else:
        query = "ORDER BY " + column_name + " DESC"

    return query

def group_by(table_name):
    # Get column to group by
    possible_choices, column_names = print_columns(table_name)
    print('Choose a column to group by.')
    column_num_str = get_choice(possible_choices)
    column_num = int(column_num_str)
    column_name = column_names[column_num - 1]

    query = "GROUP BY " + column_name
    
    return query

def limit(table_name):
    # Limit results up to number of rows
    row_count = cur.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    print(f"Enter number of rows to display, up to {row_count}.")
    limit_num = get_choice_largenum(row_count)

    query = "LIMIT " + str(limit_num)

    return query

def count(table_name):
    # SELECT COUNT(*) WHERE...
    print('Select an operation:')
    print('1. Count all rows')
    print('2. Count all non-null values in a column')
    print('3. Count all distinct values in a column')
    count_type = get_choice(['1','2','3'])

    if count_type == '1':
        row_num = cur.execute(f"SELECT COUNT (*) FROM {table_name};").fetchone()[0]
        print(f"Total Rows: {row_num}")
    elif count_type == '2':
        print('What column would you like to count all non-null values for?')
        possible_choices, column_names = print_columns(table_name)
        choice = get_choice(possible_choices)
        col_name = column_names[int(choice)-1]

        # Execute query
        result = cur.execute(f"SELECT COUNT({col_name}) FROM {table_name};").fetchone()[0]
        print(f"Total non-null values in {col_name}: {result}")

    else:
        print('What column would you like to count all distinct values for?')
        possible_choices, column_names = print_columns(table_name)
        choice = get_choice(possible_choices)
        col_name = column_names[int(choice)-1]

        # Execute query
        result = cur.execute(f"SELECT COUNT(DISTINCT {col_name}) FROM {table_name};").fetchone()[0]
        print(f"Total distinct values in {col_name}: {result}")


    return

def mathematics(table_name, function):
    # Functions: SUM, MIN, MAX, AVG
    # note: for aggregate functions, you need to use group_by, or else they will be applied to every single column
    column_names = get_numeric_columns(table_name)

    if len(column_names) == 0:
            print('No numeric columns available for mathematical operation.')
            return
        
    print(f"What column would you like to {function} the values of?")
    for i, col_name in enumerate(column_names):
        print(f"{i+1}. {col_name}")
    
    choice = get_choice([str(i+1) for i in range(len(column_names))])
    column_name = column_names[int(choice) - 1]
    
    # Execute query
    result = cur.execute(f"SELECT {function}({column_name}) FROM {table_name};").fetchone()
    print(f"{function} of {column_name}: {result[0]}")


    return

def secondary_queries(table_name):
    complete = False
    where_done = False
    order_done = False
    group_done = False
    limit_done = False
    where_query = ''
    order_query = ''
    group_query = ''
    limit_query = ''

    while complete == False:
        print('Any other operations for this query? (Leave blank for none)')
        print('1. FILTER')
        print('2. ORDER BY')
        print('3. GROUP BY')
        print('4. LIMIT')
        print('5. No other queries.')
        query_choice = get_choice(['1','2','3','4','5'])

        if query_choice == '1':
            where_query = where(table_name)
            where_done = True
        elif query_choice == '2':
            order_query = order_by(table_name)
            order_done = True
        elif query_choice == '3':
            group_query = group_by(table_name)
            group_done = True
        elif query_choice == '4':
            limit_query = limit(table_name)
            limit_done = True
        else:
            complete = True

    query = where_query + ' ' + group_query + ' ' + order_query + ' ' + limit_query
    return query
      
def query(table_name, type):
    if (type == '1'):
        # SELECT: what columns to select? what rows to select?
        select(table_name)

    elif (type == '2'):
        # DISTINCT: 
        exit

    elif (type == '3'):
        # WHERE: what values to filter on? from what columns?
        exit

    elif (type == '4'):
        # JOIN: what table to join with current? on what values?
        exit
    
    elif (type == '5'):
        # COUNT: what values to count? from what columns?
        count(table_name)
        exit

    elif (type == '6'):
        # MATHEMATICAL OPERATIONS
        print('Select what type of function to perform: ')
        print('1. Sum')
        print('2. Minimum')
        print('3. Maximum')
        print('4. Average')
        function = get_choice(['1','2','3','4'])

        num_to_function_map = {
            1: 'SUM',
            2: 'MIN',
            3: 'MAX',
            4: 'AVERAGE'
        }
        mathematics(table_name, num_to_function_map[int(function)])

    
        # AVERAGE: what column to get the AVG of?
        exit


    return

def print_first_3(table_name):
    cur.execute(f"SELECT * FROM {table_name} LIMIT 3")
    rows = cur.fetchall()
    column_names = [description[0] for description in cur.description]

    # Print column names
    print("     |   ".join(column_names))
    print("-" * 50)

    # Print rows
    for row in rows:
        print(" | ".join(str(value) for value in row))

    return

def operations(table_name):
    # Get operation choice
    operation = get_operation()
    if operation == '1':
        # Update operation (column name or data value)
        print('What do you want to update?')
        print('1. Column name')
        print('2. Row value')
        update_choice = get_choice(['1','2'])
        update_table(table_name, update_choice)

    elif operation == '2':
        # Delete operation (by row)
        print('What do you want to delete?')
        print('1. Column')
        print('2. Row')
        delete_choice = get_choice(['1','2'])
        delete(table_name, delete_choice)

    elif operation == '3':
        print('Select the query type you would like to perform: ')
        print('1. SELECT')
        print('2. DISTINCT VALUES') # UNIQUE VALUES
        print('3. FILTER') # WHERE
        print('4. JOIN TABLES')
        print('5. COUNT')
        print('6. MATHEMATICAL OPERATIONS (SUM, MIN, MAX, AVG)')
        query_choice = get_choice(['1','2','3','4','5','6'])
        query(table_name, query_choice)
        

    else:
        display_menu()

    return



# INTERFACE ----------------------------------------------
# Display menu
def display_menu():
    print('\nCMS Data')
    print('----------------------------------------------')
    print('Select a table to view or edit: ')
    print('1. Hospitals')
    print('2. Infections')
    print('3. Complications and Deaths')
    print('4. Unplanned Hospital Visits')
    print('5. Save and Exit')
    table_choices = ['1','2','3','4','5']
    table_selection = get_choice(table_choices)

    # Direct table selection to proper function
    if (table_selection == '1'):
        # Hospital functions
        print('\nHOSPITALS')
        print('----------------------------------------------')
        table_name = 'hospital'
        operations(table_name)
    elif (table_selection == '2'):
        # Infection functions
        print('\nINFECTIONS')
        print('----------------------------------------------')
        table_name = 'infections'
        operations(table_name)
    elif (table_selection == '3'):
        # C&D functions
        print('\nCOMPLICATIONS AND DEATHS')
        print('----------------------------------------------')
        table_name = 'complications_and_deaths'
        operations(table_name)
    elif (table_selection == '4'):
        # UPHV functions
        print('\nUNPLANNED HOSPITAL VISITS')
        print('----------------------------------------------')
        table_name = 'unplanned_hospital_visits'
        operations(table_name)
    elif (table_selection == '5'):
        return False  # Signal to exit
    
    return True  # Signal to continue


# Start program - LOOP until user chooses to exit
while display_menu():
    pass  # Keep looping

# Save and exit
print('Saving...')
conn.commit()  # Don't forget to commit!
conn.close()
print('Program saved and exited.')











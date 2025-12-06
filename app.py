from flask import Flask, render_template, jsonify, request
import sqlite3
import os

app = Flask(__name__)
DATABASE = 'cms_data.db'

ALLOWED_TABLES = ['hospital', 'infections', 'complications_and_deaths', 'unplanned_hospital_visits']

# HELPER FUNCTIONS -----------------------------------------------------------------------
def validate_table_name(table_name):
    if table_name not in ALLOWED_TABLES:
        return False, jsonify({'error': 'Invalid table name'}), 400
    return True, None

def validate_column_value(table_name, column_name, value):
    conn = get_db_connection()
    cur = conn.cursor()

    # get column type
    columns_info = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
    column_type = None

    for col in columns_info:
        if col['name'] == column_name:
            column_type = col['type'].upper()
            break

    conn.close()

    if column_type is None:
        return False, "Column not found", None
    
    # if value is empty string or None, allow NULL
    if value == '' or value is None:
        return True, "", None
    
    # check if input matches column type
    if column_type in ['INTEGER','INT']:
        try:
            converted = int(value)
            return True, "", converted
        except ValueError:
            return False, f"{column_name} must be a whole number (INTEGER)", None
        
    elif column_type in ['REAL', 'FLOAT', 'DOUBLE', 'NUMERIC']:
        try:
            converted = float(value)
            return True, "", converted
        except ValueError:
            return False, f"{column_name} must be a number", None
        
    else:
        # if text, anything is valid
        return True, "", str(value)


def execute_query(table_name, query_func):
    # Validate table name
    is_valid, error_response = validate_table_name(table_name)
    if not is_valid:
        return error_response
    
    # Execute query with error handling
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        result = query_func(conn, cur)
        
        conn.close()
        return result
        
    except Exception as e:
        print(f"ERROR in execute_query: {e}")
        return jsonify({'error': str(e)}), 500
    
def rows_to_dict_list(rows, column_names):
    data = []
    for row in rows:
        row_dict = {col_name: row[col_name] for col_name in column_names}
        data.append(row_dict)
    return data

def get_column_names(cur, table_name):
    columns_info = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
    return [col['name'] for col in columns_info]
    

# MAIN FUNCTIONS -----------------------------------------------------------------------
# Check if database exists
# AUTHORED BY AI
if not os.path.exists(DATABASE):
    print("=" * 60)
    print("ERROR: Database not found!")
    print("Please run 'python setup_database.py' first to create it.")
    print("=" * 60)
    exit(1)

# Connect to db
def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# Route 1: Serve the main HTML page
@app.route('/')
def index():
    return render_template('index.html')

# Route 2: Get list of all tables
@app.route('/api/tables')
def get_tables():
    conn = get_db_connection()
    cur = conn.cursor()

    # Get all table names from db
    tables = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    ).fetchall()

    conn.close()

    # Convert to list of strings
    table_names = [table['name'] for table in tables]

    return jsonify(table_names)

# Route 3: Get data from a specific table (all rows)
@app.route('/api/tables/<table_name>')
def get_table_data(table_name):
    def query(conn, cur):
        # Get column names and all rows WITH ROWID
        column_names = get_column_names(cur, table_name)
        rows = cur.execute(f"SELECT ROWID, * FROM {table_name}").fetchall()
        
        return jsonify({
            'columns': column_names,
            'rows': rows_to_dict_list(rows, ['ROWID'] + column_names),
            'total_rows': len(rows)
        })
    
    return execute_query(table_name, query)


# Route 4: Get first 20 rows (preview of data)
@app.route('/api/tables/<table_name>/preview')
def get_table_preview(table_name):
    def query(conn, cur):
        # Get column names
        column_names = get_column_names(cur, table_name)
        
        # Get first 20 rows WITH ROWID
        rows = cur.execute(f"SELECT ROWID, * FROM {table_name} LIMIT 20").fetchall()
        
        # Get total count
        total_count = cur.execute(f"SELECT COUNT(*) as count FROM {table_name}").fetchone()['count']
        
        return jsonify({
            'columns': column_names,
            'rows': rows_to_dict_list(rows, ['ROWID'] + column_names),
            'total_rows': total_count
        })
    
    return execute_query(table_name, query)

# Route 5: Get table info (for debugging/understanding)
@app.route('/api/tables/<table_name>/info')
def get_table_info(table_name):
    def query(conn, cur):
        # Get column info including types
        columns_info = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
        
        # Get row count
        row_count = cur.execute(f"SELECT COUNT(*) as count FROM {table_name}").fetchone()['count']
        
        # Format column info
        columns = []
        for col in columns_info:
            columns.append({
                'name': col['name'],
                'type': col['type'],
                'nullable': not col['notnull'],
                'primary_key': bool(col['pk'])
            })
        
        return jsonify({
            'table_name': table_name,
            'columns': columns,
            'row_count': row_count
        })
    
    return execute_query(table_name, query)


# Route 6: Deleting rows from a table
@app.route('/api/tables/<table_name>/rows/<int:row_id>', methods=['DELETE'])
def delete_row(table_name, row_id):
    def query(conn, cur):
        print(f"DEBUG: Attempting to delete row {row_id} from {table_name}")
        
        # Check if row exists before deleting
        check = cur.execute(f"SELECT COUNT(*) as count FROM {table_name} WHERE ROWID = ?", (row_id,)).fetchone()
        print(f"DEBUG: Found {check['count']} rows with ROWID {row_id}")
        
        # Execute delete query using row_id (ROWID in SQLite)
        cur.execute(f"DELETE FROM {table_name} WHERE ROWID = ?", (row_id,))
        
        # Check how many rows were affected
        print(f"DEBUG: Rows affected: {cur.rowcount}")
        
        # Commit changes
        conn.commit()
        print(f"DEBUG: Changes committed")
        
        # Verify deletion
        verify = cur.execute(f"SELECT COUNT(*) as count FROM {table_name} WHERE ROWID = ?", (row_id,)).fetchone()
        print(f"DEBUG: After delete, found {verify['count']} rows with ROWID {row_id}")
        
        # Return success message
        return jsonify({
            'success': True,
            'message': f'Row {row_id} deleted from {table_name}'
        })
    
    return execute_query(table_name, query)

# Route 7: Update a row in the table
@app.route('/api/tables/<table_name>/rows/<int:row_id>', methods=['PUT'])
def update_row(table_name, row_id):
    def query(conn, cur):
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        print(f"DEBUG: Updating row {row_id} in {table_name}")
        print(f"DEBUG: New Values: {data}")

        # validate values
        validated_data = {}
        for column_name, value in data.items():
            is_valid, error_msg, converted_value = validate_column_value(
                table_name, column_name, value
            )

            if not is_valid:
                return jsonify({'error': error_msg}), 400
            
            validated_data[column_name] = converted_value
        
        # write update query
        set_clauses = []
        values = []

        for column_name, value in validated_data.items():
            set_clauses.append(f'"{column_name}" = ?')
            values.append(value)

        # add ROWID to values for where clause
        values.append(row_id)

        update_query = f'UPDATE {table_name} SET {", ".join(set_clauses)} WHERE ROWID = ?'

        print(f"DEBUG: Query: {update_query}")
        print(f"DEBUG: Values: {values}")

        # execute the update
        cur.execute(update_query, values)

        # check if update worked
        if cur.rowcount == 0:
            return jsonify({'error': 'Row not found'}), 404
        
        conn.commit()

        print(f"DEBUG: Successfully updated {cur.rowcount} rows")

        return jsonify({
            'success': True,
            'message': f'Row {row_id} updated successfully'
        })
    
    return execute_query(table_name, query)

# Route 8: Execute custom query
@app.route('/api/tables/<table_name>/query', methods=['POST'])
def execute_custom_query(table_name):
    def query(conn, cur):
        data = request.get_json()
        
        print(f"DEBUG: Executing custom query on {table_name}")
        print(f"DEBUG: Query params: {data}")
        
        # Get column types for the table
        columns_info = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
        column_types = {}
        for col in columns_info:
            column_types[col['name']] = col['type'].upper()
        
        # Build SELECT clause
        if data['select_type'] == 'all':
            select_clause = '*'
        elif data['select_type'] == 'columns':
            select_clause = ', '.join(f'"{col}"' for col in data['columns'])
        elif data['select_type'] == 'aggregate':
            func = data['aggregate_function']
            col = data['aggregate_column']
            select_clause = f'{func}({col})'
        
        # Start building query
        sql_query = f'SELECT {select_clause} FROM {table_name}'
        params = []
        
        # Add WHERE clause
        if data.get('where_conditions'):
            where_parts = []
            
            for idx, condition in enumerate(data['where_conditions']):
                column = condition['column']
                operator = condition['operator']
                value = condition['value']
                
                # Check if column is TEXT type
                is_text_column = column_types.get(column, '').startswith('TEXT')
                collate = ' COLLATE NOCASE' if is_text_column else ''
                
                # Get connector (defaults to AND for first condition)
                connector = condition.get('connector', 'AND') if idx > 0 else ''
                
                if operator == 'LIKE':
                    where_parts.append((connector, f'"{column}"{collate} LIKE ?'))
                    params.append(f'%{value}%')
                elif operator == 'IN':
                    values = [v.strip() for v in value.split(',')]
                    placeholders = ','.join(['?'] * len(values))
                    where_parts.append((connector, f'"{column}"{collate} IN ({placeholders})'))
                    params.extend(values)
                elif operator == 'BETWEEN':
                    parts = value.split('AND')
                    if len(parts) == 2:
                        where_parts.append((connector, f'"{column}"{collate} BETWEEN ? AND ?'))
                        params.extend([parts[0].strip(), parts[1].strip()])
                else:
                    where_parts.append((connector, f'"{column}"{collate} {operator} ?'))
                    params.append(value)
            
            if where_parts:
                where_clause = where_parts[0][1]  # First condition (no connector)
                for connector, clause in where_parts[1:]:
                    where_clause += f' {connector} {clause}'
                sql_query += ' WHERE ' + where_clause
        
        # Add ORDER BY
        if data.get('order_by'):
            column = data['order_by']['column']
            direction = data['order_by']['direction']
            is_text_column = column_types.get(column, '').startswith('TEXT')
            collate = ' COLLATE NOCASE' if is_text_column else ''
            sql_query += f' ORDER BY "{column}"{collate} {direction}'
        
        # Add LIMIT
        if data.get('limit'):
            sql_query += f' LIMIT {data["limit"]}'
        
        print(f"DEBUG: Final SQL: {sql_query}")
        print(f"DEBUG: Params: {params}")
        
        # Execute query
        result = cur.execute(sql_query, params).fetchall()
        
        # Get column names from result
        if result:
            column_names = [description[0] for description in cur.description]
        else:
            column_names = []
        
        # Convert to list of dicts
        rows = []
        for row in result:
            row_dict = {}
            for i, col_name in enumerate(column_names):
                row_dict[col_name] = row[i]
            rows.append(row_dict)
        
        return jsonify({
            'columns': column_names,
            'rows': rows,
            'total_rows': len(rows),
            'query': sql_query
        })
    
    return execute_query(table_name, query)

# Route 9: Execute join query
@app.route('/api/tables/join', methods=['POST'])
def execute_join():
    try:
        data = request.get_json()
        
        print(f"DEBUG: Executing join")
        print(f"DEBUG: Join params: {data}")
        
        table1 = data['table1']
        table2 = data['table2']
        join_type = data['join_type']
        table1_columns = data['table1_columns']
        table2_columns = data['table2_columns']
        use_group_by = data.get('use_group_by', False)
        aggregate_function = data.get('aggregate_function', 'AVG')
        
        # Validate tables
        if table1 not in ALLOWED_TABLES or table2 not in ALLOWED_TABLES:
            return jsonify({'error': 'Invalid table name'}), 400
        
        # Get column types for both tables
        conn = get_db_connection()
        cur = conn.cursor()
        
        def get_column_type(table, column):
            columns_info = cur.execute(f"PRAGMA table_info({table});").fetchall()
            for col in columns_info:
                if col['name'] == column:
                    return col['type'].upper()
            return 'TEXT'
        
        # Build column list
        selected_columns = []
        
        if use_group_by:
            # Always include Facility_ID (the grouping column)
            selected_columns.append(f'{table1}.Facility_ID')
            
            # Add other table1 columns with MAX for non-numeric
            for col in table1_columns:
                if col != 'Facility_ID':
                    selected_columns.append(f'MAX({table1}."{col}") as "{col}"')
            
            # Add table2 columns with appropriate aggregation
            for col in table2_columns:
                if col != 'Facility_ID':
                    col_type = get_column_type(table2, col)
                    # Check if numeric
                    if col_type in ['INTEGER', 'INT', 'REAL', 'FLOAT', 'DOUBLE', 'NUMERIC']:
                        selected_columns.append(f'{aggregate_function}({table2}."{col}") as "{col}_{aggregate_function.lower()}"')
                    else:
                        selected_columns.append(f'MAX({table2}."{col}") as "{col}"')
        else:
            # No grouping - regular columns
            for col in table1_columns:
                selected_columns.append(f'{table1}."{col}"')
            for col in table2_columns:
                selected_columns.append(f'{table2}."{col}"')
        
        if not selected_columns:
            return jsonify({'error': 'No columns selected'}), 400
        
        columns_str = ', '.join(selected_columns)
        
        # Build JOIN query
        sql_query = f'''
            SELECT {columns_str}
            FROM {table1}
            {join_type} JOIN {table2}
                ON {table1}.Facility_ID = {table2}.Facility_ID
        '''
        
        # Add GROUP BY if specified
        if use_group_by:
            sql_query += f" GROUP BY {table1}.Facility_ID"
        
        # Add LIMIT if specified
        if data.get('limit'):
            sql_query += f" LIMIT {data['limit']}"
        
        print(f"DEBUG: Final SQL: {sql_query}")
        
        # Execute query
        result = cur.execute(sql_query).fetchall()
        
        # Get column names from result
        if result:
            column_names = [description[0] for description in cur.description]
        else:
            column_names = []
        
        conn.close()
        
        # Convert to list of dicts
        rows = []
        for row in result:
            row_dict = {}
            for i, col_name in enumerate(column_names):
                row_dict[col_name] = row[i]
            rows.append(row_dict)
        
        return jsonify({
            'columns': column_names,
            'rows': rows,
            'total_rows': len(rows),
            'query': sql_query.strip()
        })
        
    except Exception as e:
        print(f"ERROR in execute_join: {e}")
        return jsonify({'error': str(e)}), 500
    

# Start Flask development server (AUTHORED BY AI)
if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("CMS Database Web Interface")
    print("=" * 60)
    print("Server starting...")
    print("Open your browser and go to: http://127.0.0.1:5000")
    print("Press CTRL+C to stop the server")
    print("=" * 60 + "\n")
    app.run(debug=True, host='127.0.0.1', port=5000)


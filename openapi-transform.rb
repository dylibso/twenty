require 'yaml'

# This script converts Twenty's OpenAPI file into an XTP Schema
# We do not yet have an official tool do this as the Schema is still
# evolving. The gap is becoming smaller and currently, just mapping types
# is fairly easy.

def clean_and_modify_openapi(openapi_spec)
  yaml = YAML.load_file(openapi_spec)

  # Remove top-level keys
  %w[info openapi servers tags webhooks externalDocs security].each do |key|
    yaml.delete(key)
  end

  # Add new version key
  yaml['version'] = 'v1-draft'

  # Clean existing schema names
  if yaml['components'] && yaml['components']['schemas']
    cleaned_schemas = {}
    yaml['components']['schemas'].each do |name, schema|
      cleaned_name = name.gsub(/\s+/, '')
      cleaned_schemas[cleaned_name] = schema
    end
    yaml['components']['schemas'] = cleaned_schemas
  end

  # Process paths and create imports
  yaml['imports'], new_schemas = create_imports(yaml['paths'], yaml['components']['parameters'])

  if yaml['components']
    if yaml['components']['schemas']
      yaml['components']['schemas'].merge!(new_schemas)
    else
      yaml['components']['schemas'] = new_schemas
    end

    # Remove parameters, securitySchemes, and responses
    %w[parameters securitySchemes responses].each do |key|
      yaml['components'].delete(key)
    end
  end

  # Clean $ref values throughout the entire YAML
  clean_refs(yaml)

  # Remove the paths key after processing
  yaml.delete('paths')

  # Process all schemas at the end
  if yaml['components'] && yaml['components']['schemas']
    yaml['components']['schemas'].transform_values! do |schema|
      process_schema(schema)
    end
  end

  yaml
end

def create_imports(paths, global_parameters)
  imports = {}
  new_schemas = {}

  paths&.each do |path, methods|
    methods.each do |_method, details|
      next unless details['operationId']
      next unless details['operationId'] =~ /Company/

      operation_id = details['operationId'].gsub(/\s+/, '')
      input_schema_name = "#{operation_id}Input"
      input_schema_name[0] = input_schema_name[0].upcase
      output_schema_name = "#{operation_id}Output"
      output_schema_name[0] = output_schema_name[0].upcase

      # Create input schema
      input_schema = create_input_schema(path, details, global_parameters)
      new_schemas[input_schema_name] = input_schema

      # Create output schema
      output_schema = create_output_schema(details['responses'], operation_id)
      new_schemas[output_schema_name] = output_schema

      imports[operation_id] = {
        'description' => details['description'] || '',
        'input' => {
          'contentType' => 'application/json',
          '$ref' => "#/components/schemas/#{input_schema_name}"
        },
        'output' => {
          'contentType' => 'application/json',
          '$ref' => "#/components/schemas/#{output_schema_name}"
        }
      }
    end
  end

  [imports, new_schemas]
end

def create_input_schema(path, details, global_parameters)
  properties = {}
  required = []

  # Handle path parameters
  path.scan(/{([^}]+)}/).flatten.each do |param|
    properties[param] = { 'type' => 'string' }
    required << param
  end

  # Handle query parameters
  (details['parameters'] || []).each do |param|
    if param['$ref']
      param_name = param['$ref'].split('/').last
      param = global_parameters[param_name] if global_parameters && global_parameters[param_name]
    end
    next unless param['in'] == 'query'

    properties[param['name']] = { 'type' => param['schema']['type'] }
    required << param['name'] if param['required']
  end

  # Handle request body
  if details['requestBody']
    content = details['requestBody']['content']['application/json']
    if content && content['schema']
      body_schema = content['schema']
      properties['body'] = if body_schema['$ref']
                             { '$ref' => body_schema['$ref'] }
                           else
                             body_schema
                           end
      required << 'body' if details['requestBody']['required']
    end
  end

  {
    'type' => 'object',
    'properties' => properties,
    'required' => required
  }
end

def create_output_schema(responses, operation_id)
  first_response = responses.find { |code, _| code.to_i >= 200 && code.to_i < 300 }

  return {} unless first_response

  status_code, response = first_response

  schema = if response['content'] && response['content']['application/json'] && response['content']['application/json']['schema']
             response['content']['application/json']['schema']
           else
             {}
           end

  payload = if schema['$ref']
              { '$ref' => schema['$ref'] }
            elsif schema['properties'] && schema['properties']['data']
              data = schema['properties']['data']
              if data['properties'] && data['properties'].size == 1
                data['properties'].values.first
              else
                data
              end
            else
              schema
            end

  {
    'description' => "Output type for #{operation_id}",
    'properties' => {
      'statusCode' => {
        'type' => 'integer',
        'description' => 'HTTP Status code'
      },
      'payload' => payload
    }
  }
end

def process_schema(schema)
  # Remove 'type' key from the schema
  schema.delete('type')

  required_props = schema['required'] || []

  if schema['properties']
    schema['properties'].each do |prop_name, prop_def|
      prop_def['type'] = 'string' unless prop_def.key?('type')

      # Remove 'format' if it's 'uuid'
      prop_def.delete('format') if prop_def['format'] == 'uuid'

      # Remove 'enum' property
      prop_def.delete('enum')

      # Make property nullable unless it's in the required array
      prop_def['nullable'] = true unless required_props.include?(prop_name)

      # Change embedded objects to plain objects with no properties
      if prop_def['type'] == 'object' && !prop_def['$ref']
        prop_def.clear
        prop_def['type'] = 'object'
      end

      # Process items in arrays
      next unless prop_def['type'] == 'array' && prop_def['items']

      prop_def['items'] = if prop_def['items']['type'] == 'object' && !prop_def['items']['$ref']
                            { 'type' => 'object' }
                          else
                            process_schema(prop_def['items'])
                          end
    end
  end

  # Remove the 'required' key from the schema
  schema.delete('required')

  schema
end

def clean_refs(node)
  case node
  when Hash
    node.each do |key, value|
      if key == '$ref' && value.is_a?(String)
        node[key] = value.gsub(/\s+/, '')
      else
        clean_refs(value)
      end
    end
  when Array
    node.each { |item| clean_refs(item) }
  end
end

# Usage
input_file = 'twenty.yaml'
output_file = 'twenty-xtp.yaml'

modified_spec = clean_and_modify_openapi(input_file)

File.open(output_file, 'w') do |file|
  file.write(modified_spec.to_yaml)
end

puts "Modified OpenAPI spec has been saved to #{output_file}"

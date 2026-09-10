classdef ReduceMeanLayer1015 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net.coder.ReduceMeanLayer1015';
        end
    end


    methods
        function this = ReduceMeanLayer1015(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_4_38'};
        end

        function [x_blocks_blocks_4_38] = predict(this, x_blocks_blocks_4_32)
            if isdlarray(x_blocks_blocks_4_32)
                x_blocks_blocks_4_32 = stripdims(x_blocks_blocks_4_32);
            end
            x_blocks_blocks_4_32NumDims = 4;
            x_blocks_blocks_4_32 = severity_net.ops.permuteInputVar(x_blocks_blocks_4_32, [4 3 1 2], 4);

            [x_blocks_blocks_4_38, x_blocks_blocks_4_38NumDims] = ReduceMeanGraph1045(this, x_blocks_blocks_4_32, x_blocks_blocks_4_32NumDims, false);
            x_blocks_blocks_4_38 = severity_net.ops.permuteOutputVar(x_blocks_blocks_4_38, [3 4 2 1], 4);

            x_blocks_blocks_4_38 = dlarray(single(x_blocks_blocks_4_38), 'SSCB');
        end

        function [x_blocks_blocks_4_38] = forward(this, x_blocks_blocks_4_32)
            if isdlarray(x_blocks_blocks_4_32)
                x_blocks_blocks_4_32 = stripdims(x_blocks_blocks_4_32);
            end
            x_blocks_blocks_4_32NumDims = 4;
            x_blocks_blocks_4_32 = severity_net.ops.permuteInputVar(x_blocks_blocks_4_32, [4 3 1 2], 4);

            [x_blocks_blocks_4_38, x_blocks_blocks_4_38NumDims] = ReduceMeanGraph1045(this, x_blocks_blocks_4_32, x_blocks_blocks_4_32NumDims, true);
            x_blocks_blocks_4_38 = severity_net.ops.permuteOutputVar(x_blocks_blocks_4_38, [3 4 2 1], 4);

            x_blocks_blocks_4_38 = dlarray(single(x_blocks_blocks_4_38), 'SSCB');
        end

        function [x_blocks_blocks_4_38, x_blocks_blocks_4_38NumDims1047] = ReduceMeanGraph1045(this, x_blocks_blocks_4_32, x_blocks_blocks_4_32NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1046, x_blocks_blocks_4_32NumDims);
            xMean = mean(x_blocks_blocks_4_32, dims);
            x_blocks_blocks_4_38 = xMean;
            x_blocks_blocks_4_38NumDims = x_blocks_blocks_4_32NumDims;

            % Set graph output arguments
            x_blocks_blocks_4_38NumDims1047 = x_blocks_blocks_4_38NumDims;

        end

    end

end